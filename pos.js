// Minimal POS logic reusing the existing product catalog structure and queue format

(function() {
  // Image mapping for menu items
  const ITEM_IMAGES = {
    'americano': 'assets/images/americano.png',
    'espresso': 'assets/images/espresso.png',
    'espresso-doppio': 'assets/images/espresso-doppio.png',
    'cappuccino': 'assets/images/cappuccino.png',
    'latte-macchiato': 'assets/images/latte-macchiato.png',
    'tea': 'assets/images/tea.png',
    'cinnamon-bun-latte': 'assets/images/latte-macchiato-caramel.png',
    'hot-chocolate': 'assets/images/hot-chocolate.png',
    'softdrinks': 'assets/images/softdrinks.png',
    'wasser': 'assets/images/water.png',
    'redbull': 'assets/images/redbull.png'
  };

  const PRODUCT_CATALOG = [
    { id: 'coffee', title: 'Menu', items: [
      { id: 'americano', name: 'Americano', priceStudent: 1.50, priceStaff: 2.00 },
      { id: 'espresso', name: 'Espresso', priceStudent: 1.30, priceStaff: 1.80 },
      { id: 'espresso-doppio', name: 'Espresso Doppio', priceStudent: 1.70, priceStaff: 2.20 },
      { id: 'cappuccino', name: 'Cappuccino', priceStudent: 2.50, priceStaff: 3.00 },
      { id: 'latte-macchiato', name: 'Latte Macchiato', priceStudent: 2.70, priceStaff: 3.20 },
      { id: 'hot-chocolate', name: 'Hot Chocolate', priceStudent: 2.50, priceStaff: 3.00 },
      { id: 'tea', name: 'Tea', priceStudent: 1.00, priceStaff: 1.50 },
      { id: 'cinnamon-bun-latte', name: 'Cinnamon Bun Latte', priceStudent: 2.80, priceStaff: 3.30 },
      { id: 'softdrinks', name: 'Softdrinks', priceStudent: 2.00, priceStaff: 2.00 },
      { id: 'wasser', name: 'Water', priceStudent: 1.00, priceStaff: 1.00 },
      { id: 'redbull', name: 'RedBull', priceStudent: 2.00, priceStaff: 2.00 }
    ]}
  ];

  const PFAND_DEPOSIT = 2.00;
  const TAX_RATE = 0.00; // Taxes disabled on POS

  let priceMode = localStorage.getItem('kcafe_pos_price_mode') || 'student';
  let cart = {}; // id -> { id, name, price, qty, pfand }

  function formatPrice(v) { return `€${v.toFixed(2)}`; }

  function gateWithPin() {
    // Session checking is now handled by session-check.js
    // Just verify session exists and initialize POS
    const posSession = sessionStorage.getItem('pos_session');
    
    if (!posSession) {
      // session-check.js will handle redirect, but just in case:
      window.location.href = 'pos-login.html';
      return;
    }
    
    try {
      const session = JSON.parse(posSession);
      // Store session info globally for use in POS
      window.posSession = session;
      
      // Initialize POS
      initializePOS();
      
    } catch (e) {
      console.error('Error parsing POS session:', e);
      sessionStorage.removeItem('pos_session');
      window.location.href = 'pos-login.html';
    }
  }

  function initializePOS() {
    renderCategories();
    renderItems(PRODUCT_CATALOG[0].id);
    renderCart();
    setupTabs();
    setupPriceMode();
    setupButtons();
    
    // Initial queue render if on queue tab
    const activeTab = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
    if (activeTab === 'queue') {
      setTimeout(() => renderQueue().catch(err => console.error('Error rendering initial queue:', err)), 100);
    }
    
    // Set up Supabase real-time subscription
    setupRealtimeSubscription();
    
    // Listen for new orders from checkout page (cross-tab)
    // This fires automatically when localStorage changes in another tab/window
    window.addEventListener('storage', (e) => {
      if (e.key === 'kcafe_order_queue') {
        renderQueue();
        const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
        if (active === 'queue') {
          // Show notification for new order
          showNewOrderNotification();
        }
      }
    });
    
    // Also listen for same-tab custom events (when order placed in same tab)
    window.addEventListener('kcafe_new_order', (e) => {
      console.log('New order event received:', e.detail);
      renderQueue();
      const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
      if (active === 'queue') {
        showNewOrderNotification();
      }
    });
    
    // auto-refresh queue every 3s when on queue tab (backup in case events fail)
    setInterval(() => {
      const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
      if (active === 'queue') renderQueue();
    }, 3000);
  }

  async function setupRealtimeSubscription() {
    try {
      const supabase = await window.getSupabaseClient();
      if (supabase) {
        // Subscribe to order changes
        supabase
          .channel('orders')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'orders' },
            (payload) => {
              console.log('Order change detected:', payload);
              renderQueue();
              const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
              if (active === 'queue') {
                if (payload.eventType === 'INSERT') {
                  showNewOrderNotification();
                }
              }
            }
          )
          .subscribe();
      }
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
    }
  }

  function showNewOrderNotification() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    notification.innerHTML = '<i class="fas fa-bell"></i> New order received!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function renderCategories() {
    const row = document.getElementById('posCategories');
    if (!row) return;
    row.innerHTML = '';
    PRODUCT_CATALOG.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.textContent = cat.title;
      btn.addEventListener('click', () => renderItems(cat.id));
      row.appendChild(btn);
    });
  }

  function findCategory(catId) {
    return PRODUCT_CATALOG.find(c => c.id === catId);
  }

  function renderItems(catId) {
    const grid = document.getElementById('posItems');
    if (!grid) return;
    const cat = findCategory(catId) || PRODUCT_CATALOG[0];
    grid.innerHTML = '';
    cat.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      const price = priceMode === 'student' ? item.priceStudent : item.priceStaff;
      const imageSrc = ITEM_IMAGES[item.id] || 'assets/images/espresso.png';
      card.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}">
        <div class="item-name">${item.name}</div>
        <div class="item-price">${formatPrice(price)}</div>
      `;
      card.addEventListener('click', () => addToCart(item, price));
      grid.appendChild(card);
    });
  }

  let pendingCoffeeItem = null;
  let pendingCoffeePrice = null;

  function isCoffeeItem(item) {
    // Now includes both hot and cold drinks
    const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
    return coffeeCategory && coffeeCategory.items.some(coffee => coffee.id === item.id);
  }

  function needsCupOptionsOnly(item) {
    // Espresso, Espresso Doppio, Americano, and Tea only need cup selection, no milk/syrup
    const cupOnlyItems = ['tea', 'espresso', 'espresso-doppio', 'americano'];
    return cupOnlyItems.includes(item.id);
  }

  function isColdDrink(item) {
    // Cold drinks don't need cup options
    const coldDrinkIds = ['redbull', 'wasser', 'softdrinks'];
    return coldDrinkIds.includes(item.id);
  }

  function showMilkModal(item, unitPrice) {
    const modal = document.getElementById('milkModal');
    const title = document.getElementById('milkModalTitle');
    if (!modal || !title) return;
    
    pendingCoffeeItem = item;
    pendingCoffeePrice = unitPrice;
    title.textContent = `Customize ${item.name}`;
    modal.style.display = 'flex';
    
    const cupOnly = needsCupOptionsOnly(item);
    
    // Hide/show milk and syrup sections based on item type
    const milkSection = document.querySelector('.milk-options')?.parentElement;
    const syrupSection = document.querySelector('.syrup-options')?.parentElement;
    if (milkSection) milkSection.style.display = cupOnly ? 'none' : 'block';
    if (syrupSection) syrupSection.style.display = cupOnly ? 'none' : 'block';
    
    // Reset selections
    document.querySelectorAll('.milk-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('.syrup-option').forEach(opt => opt.classList.remove('selected'));
    const noSyrupOption = document.getElementById('noSyrupOption');
    if (noSyrupOption && !cupOnly) noSyrupOption.classList.add('selected');
    
    // Close modal handlers
    const closeBtn = document.getElementById('milkModalClose');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
        pendingCoffeeItem = null;
        pendingCoffeePrice = null;
      };
    }
    
    // Milk option handlers (only if not cup-only item)
    if (!cupOnly) {
      const milkOptions = document.querySelectorAll('.milk-option');
      milkOptions.forEach(option => {
        option.onclick = () => {
          milkOptions.forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');
        };
      });
      if (milkOptions.length > 0) {
        milkOptions.forEach(opt => opt.classList.remove('selected'));
        milkOptions[0].classList.add('selected');
      }
      
      // Syrup option handlers
      const syrupOptions = document.querySelectorAll('.syrup-option');
      syrupOptions.forEach(option => {
        option.onclick = () => {
          syrupOptions.forEach(opt => opt.classList.remove('selected'));
          if (noSyrupOption) noSyrupOption.classList.remove('selected');
          option.classList.add('selected');
        };
      });
      
      if (noSyrupOption) {
        noSyrupOption.onclick = () => {
          syrupOptions.forEach(opt => opt.classList.remove('selected'));
          noSyrupOption.classList.add('selected');
        };
      }
    }
    
    // Cup option handlers
    const cupOptions = document.querySelectorAll('.cup-option');
    if (cupOptions.length > 0) {
      cupOptions.forEach(opt => opt.classList.remove('selected'));
      cupOptions[0].classList.add('selected');
    }
    cupOptions.forEach(option => {
      option.onclick = () => {
        cupOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      };
    });
    
    // Add to cart button handler
    const addToCartBtn = document.getElementById('addCoffeeToCartBtn');
    if (addToCartBtn) {
      addToCartBtn.onclick = () => {
        const selectedCup = document.querySelector('.cup-option.selected');
        
        if (!selectedCup) {
          alert('Please select a cup type');
          return;
        }
        
        const cupType = selectedCup.getAttribute('data-cup');
        const cupLabel = selectedCup.getAttribute('data-label') || '';
        const cupPriceStudent = parseFloat(selectedCup.getAttribute('data-price-student') || '0');
        const cupPriceStaff = parseFloat(selectedCup.getAttribute('data-price-staff') || '0');
        const cupPfand = selectedCup.getAttribute('data-pfand') === 'true';
        const cupPrice = priceMode === 'student' ? cupPriceStudent : cupPriceStaff;
        const cupPfandAmount = cupPfand ? cupPrice : 0;
        
        if (cupOnly) {
          // For cup-only items, add directly without milk/syrup
          addItemWithCup(item, unitPrice, {
            cupType,
            cupLabel,
            cupPrice,
            cupPfandAmount
          });
        } else {
          const selectedMilk = document.querySelector('.milk-option.selected')?.getAttribute('data-milk');
          const selectedSyrup = document.querySelector('.syrup-option.selected')?.getAttribute('data-syrup');
          
          if (!selectedMilk) {
            alert('Please select a milk type');
            return;
          }
          
          const syrupId = selectedSyrup || null;
          addCoffeeToCart(item, unitPrice, selectedMilk, syrupId, {
            cupType,
            cupLabel,
            cupPrice,
            cupPfandAmount
          });
        }
        modal.style.display = 'none';
        pendingCoffeeItem = null;
        pendingCoffeePrice = null;
      };
    }
  }

  function addCoffeeToCart(item, unitPrice, milkType, syrupId = null, cupConfig) {
    // Get syrup info if selected
    let syrupPrice = 0;
    let syrupName = '';
    if (syrupId) {
      const addonsCategory = PRODUCT_CATALOG.find(cat => cat.id === 'addons');
      const syrup = addonsCategory?.items.find(s => s.id === syrupId);
      if (syrup) {
        syrupPrice = priceMode === 'student' ? syrup.priceStudent : syrup.priceStaff;
        syrupName = syrup.name;
      }
    }
    
    const milkLabel = milkType === 'cow' ? ' (Cow Milk)' : ' (Oat Milk)';
    const syrupLabel = syrupName ? ` + ${syrupName}` : '';
    const cupType = cupConfig?.cupType || 'togo';
    const cupLabel = cupConfig?.cupLabel ? ` • ${cupConfig.cupLabel}` : '';
    const cupPrice = cupConfig?.cupPrice || 0;
    const cupPfandAmount = cupConfig?.cupPfandAmount || 0;
    const cartKey = `${item.id}_${milkType}_${syrupId || 'none'}_${cupType}`;
    
    if (!cart[cartKey]) {
      cart[cartKey] = { 
        id: cartKey,
        productId: item.id,
        name: item.name + milkLabel + syrupLabel + cupLabel, 
        price: unitPrice + syrupPrice + cupPrice, 
        qty: 0, 
        pfand: false,
        milk: milkType,
        syrup: syrupId || null,
        syrupPrice: syrupPrice,
        cupType,
        cupPrice,
        cupLabel: cupConfig?.cupLabel || '',
        pfandPerUnit: cupPfandAmount
      };
    }
    cart[cartKey].qty += 1;
    renderCart();
  }

  function addItemWithCup(item, unitPrice, cupConfig) {
    const cupType = cupConfig?.cupType || 'togo';
    const cupLabel = cupConfig?.cupLabel ? ` • ${cupConfig.cupLabel}` : '';
    const cupPrice = cupConfig?.cupPrice || 0;
    const cupPfandAmount = cupConfig?.cupPfandAmount || 0;
    const cartKey = `${item.id}_${cupType}`;
    
    if (!cart[cartKey]) {
      cart[cartKey] = { 
        id: cartKey,
        productId: item.id,
        name: item.name + cupLabel, 
        price: unitPrice + cupPrice, 
        qty: 0, 
        pfand: cupPfandAmount > 0,
        cupType,
        cupPrice,
        cupLabel: cupConfig?.cupLabel || '',
        pfandPerUnit: cupPfandAmount
      };
    }
    cart[cartKey].qty += 1;
    renderCart();
  }

  function addToCart(item, unitPrice) {
    // Cold drinks don't need customization - add directly
    if (isColdDrink(item)) {
      const key = item.id;
      if (!cart[key]) {
        cart[key] = { id: key, productId: item.id, name: item.name, price: unitPrice, qty: 0, pfand: false };
      }
      cart[key].qty += 1;
      renderCart();
      return;
    }
    
    // Check if it's a coffee item - show milk selection modal
    if (isCoffeeItem(item)) {
      showMilkModal(item, unitPrice);
      return;
    }
    
    // For other non-coffee items, add directly
    const key = item.id;
    if (!cart[key]) {
      cart[key] = { id: key, productId: item.id, name: item.name, price: unitPrice, qty: 0, pfand: item.id === 'pfand' };
    }
    cart[key].qty += 1;
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    if (!list) return;
    list.innerHTML = '';
    let subtotal = 0;
    let pfand = 0;
    Object.values(cart).forEach(line => {
      const lineTotal = line.price * line.qty;
      const pfandPortion = (line.pfandPerUnit || 0) * line.qty;
      const isPfandLine = line.pfand || line.productId === 'pfand';
      if (isPfandLine) {
        pfand += lineTotal;
      } else {
        subtotal += lineTotal - pfandPortion;
        pfand += pfandPortion;
      }
      const row = document.createElement('div');
      row.className = 'cart-line';
      row.innerHTML = `
        <div>
          <div style="font-weight:600;color:#2c1810;">${line.name}</div>
          <div style="color:#5c4033;font-size:.9rem;">${formatPrice(line.price)} × ${line.qty}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-act="dec">-</button>
          <span>${line.qty}</span>
          <button class="qty-btn" data-act="inc">+</button>
          <button class="qty-btn" data-act="del" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
      `;
      row.querySelector('[data-act="inc"]').addEventListener('click', () => { line.qty += 1; renderCart(); });
      row.querySelector('[data-act="dec"]').addEventListener('click', () => { line.qty = Math.max(0, line.qty - 1); if (line.qty === 0) delete cart[line.id]; renderCart(); });
      row.querySelector('[data-act="del"]').addEventListener('click', () => { delete cart[line.id]; renderCart(); });
      list.appendChild(row);
    });
    const taxes = 0;
    const total = subtotal + pfand;
    const sEl = document.getElementById('posSubtotal'); if (sEl) sEl.textContent = formatPrice(subtotal);
    const tEl = document.getElementById('posTaxes'); if (tEl) tEl.textContent = formatPrice(taxes);
    const pEl = document.getElementById('posPfand'); if (pEl) pEl.textContent = formatPrice(pfand);
    const totEl = document.getElementById('posTotal'); if (totEl) totEl.textContent = formatPrice(total);
    // Update change calculator if it exists
    if (typeof window.updateChangeCalculator === 'function') {
      window.updateChangeCalculator();
    }
  }

  function clearCart() { cart = {}; renderCart(); }

  async function submitOrder() {
    const items = Object.values(cart).filter(l => l.qty > 0);
    if (items.length === 0) { alert('Cart is empty'); return; }

    let subtotal = 0; let pfandTotal = 0;
    items.forEach(line => {
      const lineTotal = line.price * line.qty;
      const pfandPortion = (line.pfandPerUnit || 0) * line.qty;
      const isPfandLine = line.pfand || line.productId === 'pfand';
      if (isPfandLine) {
        pfandTotal += lineTotal;
      } else {
        subtotal += lineTotal - pfandPortion;
        pfandTotal += pfandPortion;
      }
    });
    const taxes = 0;
    const total = subtotal + pfandTotal;

    const name = /** @type {HTMLInputElement} */(document.getElementById('posCustomerName'))?.value?.trim() || '';
    const email = /** @type {HTMLInputElement} */(document.getElementById('posCustomerEmail'))?.value?.trim() || '';

    const now = new Date().toISOString();
    const orderItems = items.map(line => ({
      id: line.productId || line.id,
      name: line.name,
      price: line.price,
      quantity: line.qty,
      pfand: !!(line.pfand || (line.pfandPerUnit || 0)),
      pfand_amount: line.pfand ? line.price : (line.pfandPerUnit || 0)
    }));

    // Try to save to Supabase first
    try {
      const supabase = await window.getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('orders')
          .insert([{
            customer_name: name || 'Walk-in Customer',
            customer_email: email || '',
            items: orderItems,
            subtotal: subtotal,
            pfand_deposit: pfandTotal,
            total: total,
            status: 'pending',
            source: 'in_person',
            user_type: 'guest',
            payment_status: 'pending'
          }])
          .select()
          .single();
        
        if (!error && data) {
          // Send order to Stripe Terminal for payment
          await processStripeTerminalPayment(data.id, total, name, email, orderItems);
          clearCart();
          renderQueue();
          return;
        } else {
          console.error('Error saving order to Supabase:', error);
        }
      }
    } catch (error) {
      console.error('Error with Supabase:', error);
    }
    
    // Fall back to localStorage
    const orderId = Date.now();
    const displayOrder = {
      id: orderId,
      customer: { name, email },
      items: orderItems,
      total: total,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      userType: 'walkin',
      source: 'in_person'
    };

    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    queue.push(displayOrder);
    localStorage.setItem('kcafe_order_queue', JSON.stringify(queue));

    alert(`Order #${orderId} submitted! Total ${formatPrice(total)}`);
    clearCart();
    renderQueue();
  }

  async function updateOrderStatus(orderId, newStatus) {
    // Try to update in Supabase first
    try {
      const supabase = await window.getSupabaseClient();
      if (supabase) {
        // Get the order first to check if it's a walk-in
        const { data: orderData, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (!fetchError && orderData) {
          const wasCompleted = orderData.status === 'completed';
          
          // Update status in Supabase
          const { error: updateError } = await supabase
            .from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);
          
          if (!updateError) {
            // Track sales when walk-in order is marked as completed
            if (newStatus === 'completed' && !wasCompleted && orderData.source === 'in_person') {
              trackSale({
                id: orderData.id,
                items: orderData.items || [],
                total: parseFloat(orderData.total) || 0,
                customer: {
                  name: orderData.customer_name,
                  email: orderData.customer_email
                },
                updatedAt: new Date().toISOString()
              });
            }
            renderQueue();
            return;
          } else {
            console.error('Error updating order in Supabase:', updateError);
          }
        }
      }
    } catch (error) {
      console.error('Error with Supabase update:', error);
    }
    
    // Fall back to localStorage
    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const orderIndex = queue.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      const order = queue[orderIndex];
      const wasCompleted = order.status === 'completed';
      order.status = newStatus;
      order.updatedAt = new Date().toISOString();
      localStorage.setItem('kcafe_order_queue', JSON.stringify(queue));
      
      // Track sales when walk-in order is marked as completed
      if (newStatus === 'completed' && !wasCompleted && order.source === 'in_person') {
        trackSale(order);
      }
      
      renderQueue();
    }
  }

  // Sales tracking functions
  function trackSale(order) {
    const salesKey = 'kcafe_daily_sales';
    const sales = JSON.parse(localStorage.getItem(salesKey)) || {};
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (!sales[today]) {
      sales[today] = [];
    }
    
    // Add sale record
    sales[today].push({
      orderId: order.id,
      timestamp: order.updatedAt || new Date().toISOString(),
      items: order.items || [],
      total: order.total || 0,
      customerName: order.customer?.name || '',
      customerEmail: order.customer?.email || ''
    });
    
    localStorage.setItem(salesKey, JSON.stringify(sales));
  }

  function getDailySales(date) {
    const salesKey = 'kcafe_daily_sales';
    const sales = JSON.parse(localStorage.getItem(salesKey)) || {};
    return sales[date] || [];
  }

  function aggregateDailySales(date) {
    const sales = getDailySales(date);
    const aggregated = {};
    let totalRevenue = 0;
    
    sales.forEach(sale => {
      totalRevenue += sale.total || 0;
      sale.items.forEach(item => {
        // Use item name as key to properly track milk variations
        // (e.g., "Americano (Oat Milk)" vs "Americano (Cow Milk)")
        const key = item.name;
        if (!aggregated[key]) {
          aggregated[key] = {
            id: item.id,
            name: item.name,
            quantity: 0,
            revenue: 0,
            unitPrice: item.price || 0
          };
        }
        aggregated[key].quantity += item.quantity || 0;
        aggregated[key].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    
    return {
      date,
      items: Object.values(aggregated),
      totalRevenue,
      totalOrders: sales.length
    };
  }

  function exportSalesToCSV(date) {
    const data = aggregateDailySales(date);
    const sales = getDailySales(date);
    
    // Sort items by revenue (descending)
    const sortedItems = [...data.items].sort((a, b) => b.revenue - a.revenue);
    
    // Helper function to escape CSV fields
    function escapeCSV(field) {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
    
    // Create CSV content with proper Excel formatting
    let csv = '';
    
    // Header section
    csv += `Knowledge Cafe - Daily Sales Report\n`;
    csv += `Date,${date}\n`;
    csv += `Total Orders,${data.totalOrders}\n`;
    csv += `Total Revenue,${data.totalRevenue.toFixed(2)}\n`;
    csv += `\n`;
    
    // Sales by item summary
    csv += `ITEM SALES SUMMARY\n`;
    csv += `Item Name,Quantity,Unit Price,Total Revenue\n`;
    sortedItems.forEach(item => {
      csv += `${escapeCSV(item.name)},${item.quantity},${item.unitPrice.toFixed(2)},${item.revenue.toFixed(2)}\n`;
    });
    // Add totals row
    csv += `TOTAL,,,${data.totalRevenue.toFixed(2)}\n`;
    csv += `\n`;
    
    // Detailed order list
    csv += `DETAILED ORDER LIST\n`;
    csv += `Order ID,Date,Time,Customer Name,Customer Email,Items,Total\n`;
    sales.forEach(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateStr = saleDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = saleDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const itemsList = sale.items.map(i => `${i.name} (x${i.quantity})`).join('; ');
      csv += `${sale.orderId},${escapeCSV(dateStr)},${escapeCSV(timeStr)},${escapeCSV(sale.customerName || '')},${escapeCSV(sale.customerEmail || '')},${escapeCSV(itemsList)},${sale.total.toFixed(2)}\n`;
    });
    
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;
    
    // Create download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `knowledge-cafe-sales-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function showSalesExportModal() {
    const today = new Date().toISOString().split('T')[0];
    const sales = getDailySales(today);
    
    if (sales.length === 0) {
      alert('No sales data for today yet.');
      return;
    }
    
    // Ask for date
    const dateInput = prompt(`Enter date to export (YYYY-MM-DD)\nLeave empty for today (${today}):`, today);
    if (dateInput === null) return; // User cancelled
    
    const exportDate = dateInput.trim() || today;
    const exportSales = getDailySales(exportDate);
    
    if (exportSales.length === 0) {
      alert(`No sales data found for ${exportDate}.`);
      return;
    }
    
    exportSalesToCSV(exportDate);
    alert(`Sales report for ${exportDate} exported successfully!`);
  }

  function getStatusColor(status) {
    const colors = {
      'pending': '#f59e0b', // orange
      'preparing': '#3b82f6', // blue
      'ready': '#10b981', // green
      'completed': '#6b7280' // gray
    };
    return colors[status] || '#d4a574';
  }

  function getStatusIcon(status) {
    const icons = {
      'pending': 'fa-clock',
      'preparing': 'fa-coffee',
      'ready': 'fa-check-circle',
      'completed': 'fa-check-double'
    };
    return icons[status] || 'fa-circle';
  }

  function getNextStatus(currentStatus) {
    const flow = {
      'pending': 'preparing',
      'preparing': 'ready',
      'ready': 'completed',
      'completed': 'completed' // Can't go further
    };
    return flow[currentStatus] || 'pending';
  }

  async function renderQueue() {
    try {
      const walkInList = document.getElementById('walkInQueueList');
      const onlineList = document.getElementById('onlineQueueList');
      if (!walkInList || !onlineList) {
        console.warn('Queue list elements not found. walkInList:', !!walkInList, 'onlineList:', !!onlineList);
        return;
      }
      
      let queue = [];
    
      // Try to load from Supabase first
      const supabase = await window.getSupabaseClient();
      if (supabase) {
        // Get today's orders that are not completed
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        const todayEndISO = todayEnd.toISOString();
        
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .neq('status', 'completed') // Only show active orders (pending, preparing, ready)
          .gte('created_at', todayStart) // Only today's orders
          .lte('created_at', todayEndISO)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error loading orders from Supabase:', error);
          // Fall back to localStorage
          queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
        } else if (data) {
          console.log('Loaded orders from Supabase:', data.length);
          // Transform Supabase data to match expected format
          queue = data.map(o => ({
            id: o.id,
            customer: {
              name: o.customer_name || '',
              email: o.customer_email || ''
            },
            items: o.items || [],
            total: parseFloat(o.total) || 0,
            status: o.status || 'pending',
            createdAt: o.created_at,
            updatedAt: o.updated_at,
            userType: o.user_type || 'guest',
            source: o.source || 'online',
            scheduling: o.scheduling || null
          }));
        } else {
          console.log('No orders found in Supabase');
          // Fall back to localStorage
          queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
        }
      } else {
        console.log('Supabase not available, using localStorage');
        // Supabase not available, use localStorage
        queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
      }
      
      // Filter to only today's orders (for localStorage fallback)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      queue = queue.filter(o => {
        if (!o.createdAt) return false;
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });
      
      // Separate orders by source
      const walkInOrders = queue.filter(o => o.source === 'in_person');
      const onlineOrders = queue.filter(o => o.source !== 'in_person');
      
      // Sort by status priority, then by newest first
      const statusOrder = { 'pending': 0, 'preparing': 1, 'ready': 2, 'completed': 3 };
      const sortOrders = (orders) => {
        return orders.sort((a, b) => {
          const aStatus = statusOrder[a.status] ?? 4;
          const bStatus = statusOrder[b.status] ?? 4;
          if (aStatus !== bStatus) return aStatus - bStatus;
          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          return bDate - aDate;
        });
      };
      
      walkInOrders.sort((a, b) => {
        const aStatus = statusOrder[a.status] ?? 4;
        const bStatus = statusOrder[b.status] ?? 4;
        if (aStatus !== bStatus) return aStatus - bStatus;
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      
      onlineOrders.sort((a, b) => {
        const aStatus = statusOrder[a.status] ?? 4;
        const bStatus = statusOrder[b.status] ?? 4;
        if (aStatus !== bStatus) return aStatus - bStatus;
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
    
      // Render walk-in orders
      renderOrderList(walkInList, walkInOrders);
      
      // Render online orders
      renderOrderList(onlineList, onlineOrders);
    } catch (error) {
      console.error('Error in renderQueue:', error);
      // Show error message to user
      const walkInList = document.getElementById('walkInQueueList');
      const onlineList = document.getElementById('onlineQueueList');
      if (walkInList) {
        walkInList.innerHTML = '<div style="text-align:center;padding:40px;color:#dc3545;"><i class="fas fa-exclamation-triangle" style="font-size:3rem;opacity:0.3;margin-bottom:10px;"></i><p>Error loading queue. Please refresh the page.</p></div>';
      }
      if (onlineList) {
        onlineList.innerHTML = '<div style="text-align:center;padding:40px;color:#dc3545;"><i class="fas fa-exclamation-triangle" style="font-size:3rem;opacity:0.3;margin-bottom:10px;"></i><p>Error loading queue. Please refresh the page.</p></div>';
      }
    }
  }
  
  function renderOrderList(listElement, orders) {
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (orders.length === 0) {
      listElement.innerHTML = '<div style="text-align:center;padding:40px;color:#5c4033;"><i class="fas fa-inbox" style="font-size:3rem;opacity:0.3;margin-bottom:10px;"></i><p>No orders</p></div>';
      return;
    }

    orders.forEach(o => {
      const div = document.createElement('div');
      div.className = 'queue-card';
      const status = o.status || 'pending';
      const statusColor = getStatusColor(status);
      const statusIcon = getStatusIcon(status);
      const nextStatus = getNextStatus(status);
      const who = o.customer?.name || o.customer?.email || 'Guest';
      const src = o.source || 'online';
      
      div.style.borderLeftColor = statusColor;
      
      // Build status button text
      let statusButtonText = '';
      let statusButtonClass = 'btn-status';
      if (status === 'pending') {
        statusButtonText = '<i class="fas fa-coffee"></i> Start Making';
        statusButtonClass = 'btn-status btn-status-primary';
      } else if (status === 'preparing') {
        statusButtonText = '<i class="fas fa-check-circle"></i> Mark Ready';
        statusButtonClass = 'btn-status btn-status-success';
      } else if (status === 'ready') {
        statusButtonText = '<i class="fas fa-check-double"></i> Mark Completed';
        statusButtonClass = 'btn-status btn-status-complete';
      } else {
        statusButtonText = '<i class="fas fa-check-double"></i> Completed';
        statusButtonClass = 'btn-status btn-status-disabled';
      }

      // Format order ID (show last 8 chars if UUID)
      const orderIdDisplay = typeof o.id === 'string' && o.id.length > 12 ? o.id.substring(o.id.length - 8) : o.id;
      
      // Get scheduled pickup time if available
      let scheduledTimeDisplay = '';
      if (o.scheduling && o.scheduling.scheduledFor) {
        const scheduledDate = new Date(o.scheduling.scheduledFor);
        const now = new Date();
        const isToday = scheduledDate.toDateString() === now.toDateString();
        
        if (isToday) {
          scheduledTimeDisplay = `<div style="color:#8b5e3c;font-weight:600;margin-top:4px;font-size:0.9rem;"><i class="fas fa-clock"></i> Pickup: ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>`;
        } else {
          scheduledTimeDisplay = `<div style="color:#8b5e3c;font-weight:600;margin-top:4px;font-size:0.9rem;"><i class="fas fa-calendar"></i> Pickup: ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>`;
        }
      } else if (o.scheduling && o.scheduling.type === 'immediate') {
        scheduledTimeDisplay = `<div style="color:#3b82f6;font-weight:600;margin-top:4px;font-size:0.9rem;"><i class="fas fa-bolt"></i> Ready Now</div>`;
      }
      
      div.innerHTML = `
        <div class="queue-header">
          <div class="queue-meta">
            <span><strong>#${orderIdDisplay}</strong> • ${who}</span>
            <span class="status-badge" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">
              <i class="fas ${statusIcon}"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <div class="queue-source" style="color:#5c4033;font-size:0.85rem;margin-top:4px;">
            ${src === 'in_person' ? '<i class="fas fa-walk"></i> Walk-in' : '<i class="fas fa-globe"></i> Online'} • ${o.createdAt ? new Date(o.createdAt).toLocaleTimeString() : ''}
          </div>
          ${scheduledTimeDisplay}
        </div>
        <div class="queue-items-large">
          ${o.items.map(i => `<div class="queue-item-large"><strong>${i.name}</strong> <span class="queue-item-qty">× ${i.quantity}</span></div>`).join('')}
        </div>
        <div class="queue-footer">
          <div class="queue-total">
            <strong>${formatPrice(o.total || 0)}</strong>
          </div>
          <button class="${statusButtonClass}" data-order-id="${o.id}" data-next-status="${nextStatus}" ${status === 'completed' ? 'disabled' : ''}>
            ${statusButtonText}
          </button>
        </div>
      `;
      
      // Add event listener to button (fixes onclick issue)
      const button = div.querySelector('button');
      if (button && status !== 'completed') {
        button.addEventListener('click', () => {
          const orderId = button.getAttribute('data-order-id');
          const nextStatus = button.getAttribute('data-next-status');
          updateOrderStatus(orderId, nextStatus);
        });
      }
      listElement.appendChild(div);
    });
  }

  // Make updateOrderStatus available globally for onclick handlers
  window.updateOrderStatus = updateOrderStatus;

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.pos-tab[data-tab]'));
    tabs.forEach(btn => btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      const newEl = document.getElementById('tabNew');
      const queueEl = document.getElementById('tabQueue');
      if (tab === 'new') { 
        newEl.style.display = ''; 
        queueEl.style.display = 'none'; 
      } else { 
        newEl.style.display = 'none'; 
        queueEl.style.display = ''; 
        // Small delay to ensure DOM is ready
        setTimeout(() => renderQueue(), 50);
      }
    }));
  }

  function setupPriceMode() {
    const btn = document.getElementById('priceModeBtn');
    if (!btn) return;
    
    // Update button text based on current mode
    function updateButtonText() {
      const icon = priceMode === 'student' ? '<i class="fas fa-graduation-cap"></i>' : '<i class="fas fa-user-tie"></i>';
      const text = priceMode === 'student' ? 'Student Prices' : 'Staff Prices';
      btn.innerHTML = `${icon} ${text}`;
    }
    
    updateButtonText();
    
    btn.addEventListener('click', () => {
      // Toggle between student and staff
      priceMode = priceMode === 'student' ? 'staff' : 'student';
      localStorage.setItem('kcafe_pos_price_mode', priceMode);
      updateButtonText();
      // re-render current category
      const first = PRODUCT_CATALOG[0]?.id || 'coffee';
      renderItems(first);
    });
  }

  // Process payment via Stripe Terminal
  async function processStripeTerminalPayment(orderId, total, customerName, customerEmail, orderItems) {
    try {
      // Create order description
      const orderDescription = orderItems.map(item => `${item.quantity}x ${item.name}`).join(', ');
      
      // Call backend API to create payment intent for Stripe Terminal
      const apiEndpoint = window.STRIPE_CONFIG?.terminalEndpoint || '/api/stripe/terminal/create-payment-intent';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          amount: Math.round(total * 100), // Convert to cents
          currency: 'eur',
          customerEmail: customerEmail,
          customerName: customerName,
          orderDescription: orderDescription || `Order #${orderId.substring(0, 8)}`
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }
      
      const result = await response.json();
      
      if (result.success && result.paymentIntent) {
        // Show payment status modal
        showTerminalPaymentModal(orderId, total, result.paymentIntent);
        
        // Poll for payment status
        pollPaymentStatus(orderId, result.paymentIntent.id);
      } else {
        throw new Error(result.error || 'Failed to create payment intent');
      }
    } catch (error) {
      console.error('Error processing Stripe Terminal payment:', error);
      // Fallback: Show order confirmation without payment
      alert(`Order #${orderId.substring(0, 8)} submitted! Total ${formatPrice(total)}\n\nNote: Payment terminal connection failed. Customer can pay at pickup.`);
    }
  }
  
  // Show terminal payment status modal
  function showTerminalPaymentModal(orderId, total, paymentIntent) {
    const modal = document.getElementById('terminalPaymentModal');
    if (!modal) {
      console.error('Terminal payment modal not found');
      return;
    }
    
    // Update modal content
    const orderIdEl = document.getElementById('terminalOrderId');
    const totalEl = document.getElementById('terminalTotal');
    const statusEl = document.getElementById('terminalStatus');
    
    if (orderIdEl) orderIdEl.textContent = `Order #${orderId.substring(0, 8)}`;
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-credit-card" style="font-size: 3rem; color: #d4a574; margin-bottom: 15px;"></i>
          <p style="font-size: 1.1rem; color: #2c1810; margin-bottom: 10px;">
            <strong>Waiting for payment...</strong>
          </p>
          <p style="color: #5c4033; font-size: 0.95rem;">
            Order sent to Stripe Terminal device.<br>
            Customer can tap/swipe card on terminal.
          </p>
        </div>
      `;
    }
    
    // Show modal
    modal.style.display = 'flex';
  }
  
  // Update payment status
  function updateTerminalPaymentStatus(status, message) {
    const statusEl = document.getElementById('terminalStatus');
    if (!statusEl) return;
    
    if (status === 'succeeded') {
      statusEl.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 15px;"></i>
          <p style="font-size: 1.1rem; color: #2c1810; margin-bottom: 10px;">
            <strong>Payment Successful!</strong>
          </p>
          <p style="color: #5c4033; font-size: 0.95rem;">
            ${message || 'Payment completed successfully.'}
          </p>
        </div>
      `;
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        const modal = document.getElementById('terminalPaymentModal');
        if (modal) modal.style.display = 'none';
      }, 3000);
    } else if (status === 'failed' || status === 'canceled') {
      statusEl.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-times-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 15px;"></i>
          <p style="font-size: 1.1rem; color: #2c1810; margin-bottom: 10px;">
            <strong>Payment ${status === 'failed' ? 'Failed' : 'Canceled'}</strong>
          </p>
          <p style="color: #5c4033; font-size: 0.95rem;">
            ${message || 'Payment was not completed.'}
          </p>
        </div>
      `;
    }
  }
  
  // Poll for payment status
  async function pollPaymentStatus(orderId, paymentIntentId) {
    const maxAttempts = 60; // Poll for up to 60 seconds
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const apiEndpoint = window.STRIPE_CONFIG?.terminalStatusEndpoint || '/api/stripe/terminal/payment-status';
        
        const response = await fetch(`${apiEndpoint}?paymentIntentId=${paymentIntentId}`);
        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }
        
        const result = await response.json();
        
        if (result.success && result.status) {
          if (result.status === 'succeeded') {
            // Update order status in Supabase
            await updateOrderPaymentStatus(orderId, 'completed', paymentIntentId);
            updateTerminalPaymentStatus('succeeded', 'Payment completed successfully!');
            return; // Stop polling
          } else if (result.status === 'failed' || result.status === 'canceled') {
            updateTerminalPaymentStatus(result.status, result.message || 'Payment was not completed.');
            return; // Stop polling
          }
        }
        
        // Continue polling if still processing
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 1000); // Check every second
        } else {
          updateTerminalPaymentStatus('failed', 'Payment timeout. Please try again.');
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 1000);
        }
      }
    };
    
    // Start polling
    checkStatus();
  }
  
  // Update order payment status in Supabase
  async function updateOrderPaymentStatus(orderId, status, paymentIntentId) {
    try {
      const supabase = await window.getSupabaseClient();
      if (supabase) {
        await supabase
          .from('orders')
          .update({
            payment_status: status,
            payment_method: 'stripe_terminal',
            stripe_payment_intent_id: paymentIntentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }
    } catch (error) {
      console.error('Error updating order payment status:', error);
    }
  }

  function setupButtons() {
    document.getElementById('clearCart')?.addEventListener('click', clearCart);
    document.getElementById('submitOrder')?.addEventListener('click', submitOrder);
    document.getElementById('refreshQueueBtn')?.addEventListener('click', () => {
      console.log('Manual refresh triggered');
      renderQueue();
    });
  }

  function init() {
    gateWithPin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


