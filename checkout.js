const CART_STORAGE_KEY = 'kcafe_cart_v1';

function loadCart() { try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {}; } catch { return {}; } }
function formatPrice(value) { return `€${value.toFixed(2)}`; }

function renderSummary() {
  const list = document.getElementById('summaryItems');
  const subEl = document.getElementById('sumSubtotal');
  const taxEl = document.getElementById('sumTaxes');
  const totalEl = document.getElementById('sumTotal');
  if (!list || !subEl || !taxEl || !totalEl) return;

  const cart = loadCart();
  list.innerHTML = '';

  let subtotal = 0;
  Object.values(cart).forEach(line => {
    const lineTotal = line.price * line.qty; subtotal += lineTotal;
    const li = document.createElement('li'); li.className = 'summary-line';
    li.innerHTML = `<span class="summary-name">${line.name} × ${line.qty}</span><span class="summary-price">${formatPrice(lineTotal)}</span>`;
    list.appendChild(li);
  });

  const taxes = 0.00; // Taxes disabled
  const total = subtotal; // Total equals subtotal (no tax)
  subEl.textContent = formatPrice(subtotal);
  taxEl.textContent = formatPrice(taxes);
  totalEl.textContent = formatPrice(total);
}

async function payNow() {
  const cart = loadCart();
  const items = Object.entries(cart).map(([id, line]) => ({ id, name: line.name, price: line.price, qty: line.qty }));
  if (items.length === 0) { alert('Your cart is empty'); return; }

  // Get customer info
  const customerName = document.getElementById('customerName').value;
  const customerEmail = document.getElementById('customerEmail').value;

  if (!customerName || !customerEmail) {
    alert('Please fill in your name and email.');
    return;
  }

  // Calculate totals
  let subtotal = 0;
  const taxRate = 0.00; // Taxes disabled (matching POS)
  items.forEach(item => {
    subtotal += item.price * item.qty;
  });
  const taxes = 0.00; // No taxes
  const total = subtotal; // Total equals subtotal (no tax)

  // Calculate Pfand
  let pfandTotal = 0;
  const pfandItems = items.filter(item => cart[item.id]?.pfand);
        pfandTotal = pfandItems.reduce((sum, item) => sum + (2.00 * item.qty), 0);

  // Get scheduling information
  const scheduling = getScheduledPickupTime();
  if (!scheduling) return; // Validation failed
  
  // Create order
  const order = {
    id: Date.now(),
    date: new Date().toISOString(),
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.qty,
      pfand: cart[item.id]?.pfand || false
    })),
    customer: {
      name: customerName,
      email: customerEmail
    },
    subtotal: subtotal,
    taxes: taxes,
    pfand: pfandTotal,
    total: total + pfandTotal,
    scheduling: scheduling,
    status: 'pending',
    payment_method: 'pay_at_pickup',
    payment_status: 'pending'
  };

  // Save order to user profile if logged in
  const currentUser = JSON.parse(localStorage.getItem('kcafe_current_user'));
  if (currentUser) {
    // Update user's order history
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex].orders = users[userIndex].orders || [];
      users[userIndex].orders.unshift(order);
      users[userIndex].totalOrders = (users[userIndex].totalOrders || 0) + 1;
      users[userIndex].totalSpent = (users[userIndex].totalSpent || 0) + total;
      
      // Add loyalty visit
      users[userIndex].loyaltyVisits = (users[userIndex].loyaltyVisits || 0) + 1;
      
      // Update Pfand data
      if (pfandTotal > 0) {
        const pfandData = users[userIndex].pfandData || {
          cupsOutstanding: 0,
          cupsReturned: 0,
          totalDepositPaid: 0,
          totalDepositReturned: 0,
          activity: []
        };
        
        const cupsAdded = pfandItems.reduce((sum, item) => sum + item.qty, 0);
        pfandData.cupsOutstanding += cupsAdded;
        pfandData.totalDepositPaid += pfandTotal;
        pfandData.activity.unshift({
          type: 'deposit',
          amount: pfandTotal,
          cups: cupsAdded,
          description: `Order #${order.id} - ${cupsAdded} cup${cupsAdded > 1 ? 's' : ''}`,
          date: new Date().toISOString()
        });
        
        users[userIndex].pfandData = pfandData;
      }
      
      localStorage.setItem('kcafe_users', JSON.stringify(users));
      
      // Update current user
      currentUser.orders = users[userIndex].orders;
      currentUser.totalOrders = users[userIndex].totalOrders;
      currentUser.totalSpent = users[userIndex].totalSpent;
      currentUser.loyaltyVisits = users[userIndex].loyaltyVisits;
      currentUser.pfandData = users[userIndex].pfandData;
      localStorage.setItem('kcafe_current_user', JSON.stringify(currentUser));
    }
  }

  // Helper function to save to localStorage (fallback)
  function saveToLocalStorage(order, currentUser) {
    const orderQueue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const displayOrder = {
      id: order.id,
      customer: order.customer,
      items: order.items,
      total: order.total,
      status: 'pending',
      createdAt: order.date,
      updatedAt: order.date,
      userType: currentUser ? currentUser.userType : 'guest',
      source: 'online'
    };
    orderQueue.push(displayOrder);
    localStorage.setItem('kcafe_order_queue', JSON.stringify(orderQueue));
    
    // Trigger custom event
    window.dispatchEvent(new CustomEvent('kcafe_new_order', {
      detail: { orderId: order.id, order: displayOrder }
    }));
  }

  // Save order to Supabase
  try {
    const supabase = await window.getSupabaseClient();
    if (supabase) {
      // Generate a UUID-compatible ID (use timestamp + random)
      const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          customer_name: order.customer.name,
          customer_email: order.customer.email,
          items: order.items,
          subtotal: order.subtotal,
          pfand_deposit: order.pfand || 0,
          total: order.total,
          status: 'pending',
          scheduling: order.scheduling || null,
          source: 'online',
          user_type: currentUser ? currentUser.userType : 'guest',
          payment_status: 'pending',
          payment_method: 'pay_at_pickup'
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error saving order to Supabase:', error);
        // Fall back to localStorage if Supabase fails
        saveToLocalStorage(order, currentUser);
      } else {
        console.log('Order saved to Supabase:', data);
        // Update order.id with the database ID
        order.id = data.id;
        // Trigger custom event for same-tab communication
        window.dispatchEvent(new CustomEvent('kcafe_new_order', {
          detail: { orderId: data.id, order: data }
        }));
      }
    } else {
      // Supabase not available, use localStorage
      saveToLocalStorage(order, currentUser);
    }
  } catch (error) {
    console.error('Error with Supabase:', error);
    // Fall back to localStorage
    saveToLocalStorage(order, currentUser);
  }

  // Clear cart
  localStorage.removeItem('kcafe_cart_v1');
  
  // Show success message
  const schedulingText = scheduling.type === 'immediate' 
    ? 'Your order is being prepared! (5-7 minutes)'
    : `Your order is scheduled for ${new Date(scheduling.scheduledFor).toLocaleDateString()} at ${new Date(scheduling.scheduledFor).toLocaleTimeString()}`;
    
  alert(`Order placed successfully!\nOrder #${order.id}\nTotal: €${(total + pfandTotal).toFixed(2)}\n\n${schedulingText}\n\nPlease pay when you collect your order. You will receive a notification when your order is ready!`);
  
  // Redirect to profile if logged in, otherwise to home
  if (currentUser) {
    window.location.href = '/profile.html';
  } else {
    window.location.href = '/index.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderSummary();
  // Wait a bit for session manager to initialize
  setTimeout(() => {
    loadUserInfo();
  }, 100);
  requestNotificationPermission(); // Request notification permission
  setupScheduling(); // Setup order scheduling
  const btn = document.getElementById('payNow'); if (btn) btn.addEventListener('click', payNow);
  
  // Listen for session changes
  window.addEventListener('kcafe_session_change', (e) => {
    if (e.detail.isAuthenticated) {
      loadUserInfo();
    }
  });
});

function loadUserInfo() {
  // Try session manager first (Supabase Auth)
  if (window.sessionManager && window.sessionManager.isAuthenticated()) {
    const nameField = document.getElementById('customerName');
    const emailField = document.getElementById('customerEmail');
    
    if (nameField) nameField.value = window.sessionManager.getUserName() || '';
    if (emailField) emailField.value = window.sessionManager.getUserEmail() || '';
    
    // Make fields read-only for logged-in users
    return;
  }
  
  // Fallback to localStorage
  const currentUser = JSON.parse(localStorage.getItem('kcafe_current_user'));
  if (currentUser) {
    // Auto-fill contact information for logged-in users
    const nameField = document.getElementById('customerName');
    const emailField = document.getElementById('customerEmail');
    
    if (nameField) nameField.value = currentUser.name || '';
    if (emailField) emailField.value = currentUser.email || '';
    
    // Make fields read-only for logged-in users
    if (nameField) {
      nameField.readOnly = true;
      nameField.style.backgroundColor = '#f5f5f5';
    }
    if (emailField) {
      emailField.readOnly = true;
      emailField.style.backgroundColor = '#f5f5f5';
    }
    
    // Add a note that info is from their profile
    const customerCard = document.querySelector('.customer-card');
    if (customerCard) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size: 0.9rem; color: #666; margin-top: 10px; font-style: italic;';
      note.innerHTML = '✓ Contact information loaded from your profile';
      customerCard.appendChild(note);
    }
  }
}

// Notification Functions
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('❌ This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('✅ Notifications already enabled');
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Notification permission granted!');
      showNotificationToast('🔔 Notifications enabled! You\'ll be notified when your order is ready.', 'success');
      return true;
    } else {
      console.log('❌ Notification permission denied');
      showNotificationToast('🔕 Notifications disabled. You can enable them in your browser settings.', 'info');
      return false;
    }
  }

  console.log('❌ Notifications blocked by user');
  return false;
}

function showNotificationToast(message, type = 'info') {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = `notification-toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  
  // Add styles
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 0.9rem;
    max-width: 300px;
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

async function sendOrderReadyNotification(orderId, customerName, items) {
  if (Notification.permission !== 'granted') {
    console.log('❌ Cannot send notification - permission not granted');
    return;
  }

  const itemNames = items.map(item => item.name).join(', ');
  const notification = new Notification('Order Ready! ☕', {
    body: `Hi ${customerName}! Your order (${itemNames}) is ready for pickup.`,
    icon: '/assets/icon-192x192.png',
    badge: '/assets/badge-72x72.png',
    tag: `order-${orderId}`,
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Order',
        icon: '/assets/view-icon.png'
      }
    ]
  });

  notification.onclick = function() {
    window.focus();
    notification.close();
    // Could navigate to order status page
  };

  // Auto close after 10 seconds
  setTimeout(() => {
    notification.close();
  }, 10000);
}

// Get current time in CET timezone
function getCurrentCETTime() {
  const now = new Date();
  // Convert to CET (UTC+1 in winter, UTC+2 in summer)
  // Using toLocaleString with timeZone option for accurate CET time
  const cetTimeString = now.toLocaleString('en-US', { 
    timeZone: 'Europe/Berlin', // Berlin uses CET/CEST
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  
  const [hours, minutes] = cetTimeString.split(':').map(Number);
  return { hours, minutes, fullDate: now };
}

// Check if current time is within business hours (11:00-14:00 CET)
function isWithinBusinessHours() {
  const cet = getCurrentCETTime();
  return cet.hours >= 11 && cet.hours < 14;
}

// Order Scheduling Functions
// Generate time slots (11:00, 11:30, 12:00, 12:30, 13:00, 13:30)
function generateTimeSlots() {
  const slots = [];
  for (let hour = 11; hour < 14; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
}

// Render time slot buttons
function renderTimeSlots(selectedDate = null) {
  const timeSlotsGrid = document.getElementById('timeSlotsGrid');
  if (!timeSlotsGrid) return;
  
  const slots = generateTimeSlots();
  timeSlotsGrid.innerHTML = '';
  
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot-btn';
    btn.textContent = slot;
    btn.dataset.time = slot;
    
    // Check if this time slot is in the past (if date is today)
    if (selectedDate) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        const [hours, minutes] = slot.split(':').map(Number);
        const now = new Date();
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        
        // If slot is in the past, disable it
        if (slotTime <= now) {
          btn.classList.add('disabled');
          btn.disabled = true;
        }
      }
    }
    
    btn.addEventListener('click', () => {
      // Remove selected class from all buttons
      document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
      
      // Add selected class to clicked button
      if (!btn.disabled) {
        btn.classList.add('selected');
        document.getElementById('pickupTimeInput').value = slot;
      }
    });
    
    timeSlotsGrid.appendChild(btn);
  });
}

function setupScheduling() {
  const pickupTimeRadios = document.querySelectorAll('input[name="pickupTime"]');
  const scheduledTimeDiv = document.getElementById('scheduledTime');
  const pickupDateInput = document.getElementById('pickupDate');
  const pickupTimeInput = document.getElementById('pickupTimeInput');
  const readyNowRadio = document.querySelector('input[name="pickupTime"][value="now"]');
  const readyNowLabel = readyNowRadio?.closest('label');
  
  // Check if we're within business hours
  const withinHours = isWithinBusinessHours();
  const cet = getCurrentCETTime();
  
  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];
  if (pickupDateInput) {
    pickupDateInput.min = today;
    pickupDateInput.value = today;
  }
  
  // Generate time slots
  renderTimeSlots(today);
  
  // Set default time to 11:30 (within business hours 11:00-14:00)
  let defaultTime = '11:30'; // Default to 11:30 AM
  
  // If current time is within business hours, use next available slot
  if (withinHours) {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHour = now.getHours();
    
    // Round up to next 30-minute slot
    let nextSlotMinutes = currentMinutes <= 30 ? 30 : 60;
    let nextSlotHour = currentHour;
    
    if (nextSlotMinutes === 60) {
      nextSlotMinutes = 0;
      nextSlotHour += 1;
    }
    
    // Make sure it's within business hours
    if (nextSlotHour >= 11 && nextSlotHour < 14) {
      defaultTime = `${String(nextSlotHour).padStart(2, '0')}:${String(nextSlotMinutes).padStart(2, '0')}`;
    }
  }
  
  // Select default time slot
  setTimeout(() => {
    const defaultBtn = document.querySelector(`.time-slot-btn[data-time="${defaultTime}"]`);
    if (defaultBtn && !defaultBtn.disabled) {
      defaultBtn.click();
    } else {
      // If default is disabled, select first available slot
      const firstAvailable = document.querySelector('.time-slot-btn:not(.disabled)');
      if (firstAvailable) {
        firstAvailable.click();
      }
    }
  }, 100);
  
  // If outside business hours, disable "Ready Now" and force "Schedule for Later"
  if (!withinHours) {
    if (readyNowRadio) {
      readyNowRadio.disabled = true;
      readyNowRadio.checked = false;
    }
    
    // Check "Schedule for Later" by default
    const scheduledRadio = document.querySelector('input[name="pickupTime"][value="scheduled"]');
    if (scheduledRadio) {
      scheduledRadio.checked = true;
      scheduledRadio.click(); // Trigger the change event
    }
    
    // Show message about business hours
    if (readyNowLabel) {
      const warningMsg = document.createElement('div');
      warningMsg.id = 'businessHoursWarning';
      warningMsg.style.cssText = 'background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 12px; margin-top: 10px; color: #856404; font-size: 0.9rem;';
      warningMsg.innerHTML = `
        <i class="fas fa-clock" style="margin-right: 8px;"></i>
        <strong>We're currently closed!</strong> We're open 11:00-14:00 CET. 
        Current time: ${String(cet.hours).padStart(2, '0')}:${String(cet.minutes).padStart(2, '0')} CET.
        Please schedule your order for when we're open.
      `;
      
      // Insert warning after scheduling options
      const schedulingOptions = document.querySelector('.scheduling-options');
      if (schedulingOptions && !document.getElementById('businessHoursWarning')) {
        schedulingOptions.parentNode.insertBefore(warningMsg, schedulingOptions.nextSibling);
      }
      
      // Update label to show it's disabled
      if (readyNowLabel) {
        readyNowLabel.style.opacity = '0.5';
        readyNowLabel.style.cursor = 'not-allowed';
        const smallText = readyNowLabel.querySelector('small');
        if (smallText) {
          smallText.textContent = 'Only available 11:00-14:00 CET';
          smallText.style.color = '#dc3545';
        }
      }
    }
  } else {
    // Within business hours - enable "Ready Now"
    if (readyNowRadio) {
      readyNowRadio.disabled = false;
      if (!document.querySelector('input[name="pickupTime"]:checked')) {
        readyNowRadio.checked = true;
      }
    }
    
    if (readyNowLabel) {
      readyNowLabel.style.opacity = '1';
      readyNowLabel.style.cursor = 'pointer';
      const smallText = readyNowLabel.querySelector('small');
      if (smallText) {
        smallText.textContent = 'Prepare immediately (5-7 minutes)';
        smallText.style.color = '';
      }
    }
    
    // Remove warning if it exists
    const warning = document.getElementById('businessHoursWarning');
    if (warning) {
      warning.remove();
    }
  }
  
  // Handle date change - re-render time slots
  if (pickupDateInput) {
    pickupDateInput.addEventListener('change', (e) => {
      renderTimeSlots(e.target.value);
      // Auto-select first available slot
      setTimeout(() => {
        const firstAvailable = document.querySelector('.time-slot-btn:not(.disabled)');
        if (firstAvailable) {
          firstAvailable.click();
        }
      }, 50);
      validateScheduledTime();
    });
  }
  
  // Handle pickup time selection
  pickupTimeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'scheduled') {
        scheduledTimeDiv.style.display = 'block';
        // Make date/time required
        if (pickupDateInput) pickupDateInput.required = true;
        if (pickupTimeInput) pickupTimeInput.required = true;
      } else {
        scheduledTimeDiv.style.display = 'none';
        // Make date/time not required
        if (pickupDateInput) pickupDateInput.required = false;
        if (pickupTimeInput) pickupTimeInput.required = false;
      }
    });
  });
  
  // Validate scheduled time when time slot is selected
  if (pickupTimeInput) {
    pickupTimeInput.addEventListener('change', validateScheduledTime);
  }
}

function validateScheduledTime() {
  const pickupDate = document.getElementById('pickupDate').value;
  const pickupTime = document.getElementById('pickupTimeInput').value;
  
  if (!pickupDate) return false;
  if (!pickupTime) {
    alert('Please select a pickup time slot.');
    return false;
  }
  
  // Create date in CET timezone
  const scheduledDateTime = new Date(`${pickupDate}T${pickupTime}:00`);
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7); // 7 days in advance
  
  // Check if time is in the past
  if (scheduledDateTime <= now) {
    alert('Please select a future date and time for pickup.');
    document.getElementById('pickupDate').value = '';
    document.getElementById('pickupTimeInput').value = '';
    // Clear selected time slot
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    return false;
  }
  
  // Check if time is too far in advance
  if (scheduledDateTime > maxDate) {
    alert('Orders can only be scheduled up to 7 days in advance.');
    document.getElementById('pickupDate').value = '';
    document.getElementById('pickupTimeInput').value = '';
    // Clear selected time slot
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    return false;
  }
  
  // Check if time is within business hours (11:00-14:00 CET)
  // Get the hour in CET timezone
  const cetHour = scheduledDateTime.toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });
  const hour = parseInt(cetHour);
  
  if (hour < 11 || hour >= 14) {
    alert('Please select a time between 11:00 AM and 2:00 PM CET.');
    document.getElementById('pickupTimeInput').value = '';
    // Clear selected time slot
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    return false;
  }
  
  return true;
}

function getScheduledPickupTime() {
  const pickupTime = document.querySelector('input[name="pickupTime"]:checked');
  
  if (!pickupTime) {
    alert('Please select a pickup time option.');
    return null;
  }
  
  // Prevent "Ready Now" orders outside business hours
  if (pickupTime.value === 'now') {
    if (!isWithinBusinessHours()) {
      alert('Sorry! We\'re currently closed. We\'re open 11:00-14:00 CET. Please schedule your order for when we\'re open.');
      // Force schedule option
      const scheduledRadio = document.querySelector('input[name="pickupTime"][value="scheduled"]');
      if (scheduledRadio) {
        scheduledRadio.checked = true;
        scheduledRadio.click();
      }
      return null;
    }
    
    return {
      type: 'immediate',
      scheduledFor: new Date().toISOString(),
      displayText: 'Ready Now'
    };
  } else {
    const pickupDate = document.getElementById('pickupDate').value;
    const pickupTimeInput = document.getElementById('pickupTimeInput').value;
    
    if (!pickupDate || !pickupTimeInput) {
      alert('Please select a pickup date and time.');
      return null;
    }
    
    if (!validateScheduledTime()) {
      return null;
    }
    
    const scheduledDateTime = new Date(`${pickupDate}T${pickupTimeInput}`);
    return {
      type: 'scheduled',
      scheduledFor: scheduledDateTime.toISOString(),
      displayText: `Scheduled for ${scheduledDateTime.toLocaleDateString()} at ${scheduledDateTime.toLocaleTimeString()}`
    };
  }
}


