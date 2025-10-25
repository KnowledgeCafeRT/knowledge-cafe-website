class OrderDisplay {
  constructor() {
    this.orders = [];
    this.refreshInterval = null;
    this.refreshTimer = 30; // seconds
    this.init();
  }

  init() {
    this.loadOrders();
    this.renderOrders();
    this.startAutoRefresh();
    this.setupEventListeners();
  }

  loadOrders() {
    // Load orders from localStorage
    const orderQueue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    console.log('📦 Loading orders from localStorage:', orderQueue);
    this.orders = orderQueue.filter(order => 
      order.status === 'pending' || 
      order.status === 'preparing' || 
      order.status === 'ready'
    );
    console.log('📋 Filtered orders for display:', this.orders);
  }

  renderOrders() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-coffee"></i>
          <h3>No Orders Yet</h3>
          <p>Waiting for orders to come in...</p>
        </div>
      `;
      this.updateStats();
      return;
    }

    // Sort orders by status and time
    const sortedOrders = this.orders.sort((a, b) => {
      const statusOrder = { 'pending': 0, 'preparing': 1, 'ready': 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    container.innerHTML = sortedOrders.map(order => this.renderOrderCard(order)).join('');
    this.updateStats();
  }

  renderOrderCard(order) {
    const statusClass = `status-${order.status}`;
    const cardClass = `order-card ${order.status}`;
    
    const timeAgo = this.getTimeAgo(order.createdAt);
    const estimatedTime = this.getEstimatedTime(order);
    
    return `
      <div class="order-card ${order.status}" data-order-id="${order.id}">
        <div class="order-header">
          <div class="order-number">#${order.id}</div>
          <div class="order-status ${statusClass}">${order.status}</div>
        </div>
        
        <div class="order-customer">
          <div class="customer-name">${order.customer.name}</div>
          <div class="customer-info">
            ${order.customer.email} • ${timeAgo}
            ${estimatedTime ? ` • Est. ${estimatedTime}` : ''}
          </div>
        </div>
        
        <div class="order-items">
          ${order.items.map(item => `
            <div class="order-item">
              <span class="item-name">${item.name}</span>
              <span class="item-quantity">×${item.quantity}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="order-total">
          <span class="total-label">Total</span>
          <span class="total-amount">€${order.total.toFixed(2)}</span>
        </div>
        
        <div class="order-actions">
          ${this.renderActionButtons(order)}
        </div>
      </div>
    `;
  }

  renderActionButtons(order) {
    switch (order.status) {
      case 'pending':
        return `<button class="action-btn btn-start" onclick="orderDisplay.startOrder(${order.id})">
          <i class="fas fa-play"></i> Start Preparing
        </button>`;
      case 'preparing':
        return `<button class="action-btn btn-complete" onclick="orderDisplay.completeOrder(${order.id})">
          <i class="fas fa-check"></i> Mark Ready
        </button>`;
      case 'ready':
        return `<button class="action-btn btn-complete" onclick="orderDisplay.collectOrder(${order.id})" style="background: #6b7280;">
          <i class="fas fa-hand-holding"></i> Collected
        </button>`;
      default:
        return '';
    }
  }

  startOrder(orderId) {
    this.updateOrderStatus(orderId, 'preparing');
    this.showNotification(`Order #${orderId} started!`, 'success');
  }

  completeOrder(orderId) {
    this.updateOrderStatus(orderId, 'ready');
    this.showNotification(`Order #${orderId} is ready for collection!`, 'success');
    
    // Play notification sound (if supported)
    this.playNotificationSound();
  }

  collectOrder(orderId) {
    this.removeOrder(orderId);
    this.showNotification(`Order #${orderId} collected!`, 'info');
  }

  updateOrderStatus(orderId, newStatus) {
    const orderQueue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const orderIndex = orderQueue.findIndex(order => order.id === orderId);
    
    if (orderIndex !== -1) {
      orderQueue[orderIndex].status = newStatus;
      orderQueue[orderIndex].updatedAt = new Date().toISOString();
      localStorage.setItem('kcafe_order_queue', JSON.stringify(orderQueue));
      
      // Send push notification if order is ready
      if (newStatus === 'ready') {
        this.sendOrderReadyNotification(orderQueue[orderIndex]);
      }
      
      this.loadOrders();
      this.renderOrders();
    }
  }

  removeOrder(orderId) {
    const orderQueue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const filteredOrders = orderQueue.filter(order => order.id !== orderId);
    localStorage.setItem('kcafe_order_queue', JSON.stringify(filteredOrders));
    
    this.loadOrders();
    this.renderOrders();
  }

  getTimeAgo(createdAt) {
    const now = new Date();
    const orderTime = new Date(createdAt);
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  }

  getEstimatedTime(order) {
    if (order.status === 'ready') return null;
    
    const now = new Date();
    const orderTime = new Date(order.createdAt);
    const diffMins = Math.floor((now - orderTime) / 60000);
    
    // Estimate based on order complexity
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedPrepTime = Math.max(5, itemCount * 2); // 2 minutes per item, minimum 5 minutes
    
    if (order.status === 'preparing') {
      const remainingTime = Math.max(0, estimatedPrepTime - diffMins);
      return remainingTime > 0 ? `${remainingTime}m` : 'Any moment';
    }
    
    return `${estimatedPrepTime}m`;
  }

  updateStats() {
    const pending = this.orders.filter(o => o.status === 'pending').length;
    const preparing = this.orders.filter(o => o.status === 'preparing').length;
    const ready = this.orders.filter(o => o.status === 'ready').length;
    
    // Get total orders today
    const today = new Date().toDateString();
    const allOrders = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const todayOrders = allOrders.filter(order => 
      new Date(order.createdAt).toDateString() === today
    ).length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('preparingCount').textContent = preparing;
    document.getElementById('readyCount').textContent = ready;
    document.getElementById('totalOrders').textContent = todayOrders;
    
    // Update Pfand tracking
    this.updatePfandStats();
  }

  updatePfandStats() {
    // Get all users with Pfand data
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const currentUser = JSON.parse(localStorage.getItem('kcafe_current_user'));
    
    let totalCupsOut = 0;
    let totalPfandValue = 0;
    let customersWithCups = 0;
    const customersWithPfand = [];
    
    // Check all users for outstanding Pfand
    users.forEach(user => {
      if (user.pfandData && user.pfandData.cupsOutstanding > 0) {
        totalCupsOut += user.pfandData.cupsOutstanding;
        totalPfandValue += user.pfandData.cupsOutstanding * 2.00; // €2 per cup
        customersWithCups++;
        
        customersWithPfand.push({
          name: user.name,
          email: user.email,
          userType: user.userType,
          cupsOutstanding: user.pfandData.cupsOutstanding,
          pfandValue: user.pfandData.cupsOutstanding * 2.00,
          lastOrder: this.getLastOrderDate(user.id)
        });
      }
    });
    
    // Update Pfand stats
    document.getElementById('totalCupsOut').textContent = totalCupsOut;
    document.getElementById('totalPfandValue').textContent = `€${totalPfandValue.toFixed(2)}`;
    document.getElementById('customersWithCups').textContent = customersWithCups;
    
    // Render customer list
    this.renderPfandCustomers(customersWithPfand);
  }

  renderPfandCustomers(customers) {
    const container = document.getElementById('customersList');
    
    if (customers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-coffee"></i>
          <p>No outstanding cups</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = customers.map(customer => `
      <div class="customer-pfand-card">
        <div class="customer-header">
          <div class="customer-name">${customer.name}</div>
          <div class="customer-type">${customer.userType}</div>
        </div>
        <div class="customer-details">
          <div>📧 ${customer.email}</div>
          <div>📅 Last order: ${customer.lastOrder}</div>
        </div>
        <div class="pfand-details">
          <div class="cups-count">☕ ${customer.cupsOutstanding} cup${customer.cupsOutstanding > 1 ? 's' : ''}</div>
          <div class="pfand-amount">€${customer.pfandValue.toFixed(2)}</div>
          <button class="return-btn" onclick="orderDisplay.markCupsReturned('${customer.email}')">
            Mark Returned
          </button>
        </div>
      </div>
    `).join('');
  }

  getLastOrderDate(userId) {
    const allOrders = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const userOrders = allOrders.filter(order => 
      order.customer && order.customer.email && 
      this.getUserByEmail(order.customer.email)?.id === userId
    );
    
    if (userOrders.length === 0) return 'Never';
    
    const lastOrder = userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return new Date(lastOrder.createdAt).toLocaleDateString();
  }

  getUserByEmail(email) {
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    return users.find(user => user.email === email);
  }

  markCupsReturned(customerEmail) {
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const userIndex = users.findIndex(user => user.email === customerEmail);
    
    if (userIndex !== -1 && users[userIndex].pfandData) {
      const user = users[userIndex];
      const cupsReturned = user.pfandData.cupsOutstanding;
      const depositReturned = cupsReturned * 2.00;
      
      // Update Pfand data
      user.pfandData.cupsOutstanding = 0;
      user.pfandData.cupsReturned += cupsReturned;
      user.pfandData.totalDepositReturned += depositReturned;
      
      // Add return activity
      user.pfandData.activity.unshift({
        type: 'return',
        amount: depositReturned,
        cups: cupsReturned,
        description: `Cups returned - ${cupsReturned} cup${cupsReturned > 1 ? 's' : ''}`,
        date: new Date().toISOString()
      });
      
      // Save updated user data
      localStorage.setItem('kcafe_users', JSON.stringify(users));
      
      // Update current user if it's the same person
      const currentUser = JSON.parse(localStorage.getItem('kcafe_current_user'));
      if (currentUser && currentUser.email === customerEmail) {
        currentUser.pfandData = user.pfandData;
        localStorage.setItem('kcafe_current_user', JSON.stringify(currentUser));
      }
      
      // Refresh display
      this.updatePfandStats();
      this.showNotification(`${user.name} returned ${cupsReturned} cup${cupsReturned > 1 ? 's' : ''}`, 'success');
    }
  }

  // Quick Return System Methods
  showQRScanner() {
    document.getElementById('qrModal').style.display = 'block';
    // Initialize camera-based QR scanner
    try {
      if (window.Html5Qrcode) {
        const readerElId = 'qrReader';
        const qrRegion = document.getElementById(readerElId);
        qrRegion.innerHTML = '';
        this.html5QrCode = new Html5Qrcode(readerElId);
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        this.html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
          // Try to parse JSON QR first
          try {
            const data = JSON.parse(decodedText);
            if (data && data.type === 'pfand_return' && data.email) {
              const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
              const customer = users.find(u => u.email === data.email);
              if (customer) {
                this.closeQRModal();
                this.confirmCupReturn(customer);
                this.html5QrCode.stop().catch(() => {});
                return;
              }
            }
          } catch (_) {}

          // Fallback: treat as identifier
          this.findCustomerByQR(decodedText);
          this.closeQRModal();
          this.html5QrCode.stop().catch(() => {});
        }, (errorMessage) => {
          // ignore continuous scan errors
        });
      }
    } catch (err) {
      console.log('QR scanner init failed:', err);
    }
  }

  closeQRModal() {
    document.getElementById('qrModal').style.display = 'none';
    document.getElementById('manualQR').value = '';
    if (this.html5QrCode) {
      try { this.html5QrCode.stop().catch(() => {}); } catch (_) {}
      this.html5QrCode = null;
    }
  }

  processManualQR() {
    const qrCode = document.getElementById('manualQR').value.trim();
    if (!qrCode) {
      this.showNotification('Please enter a QR code', 'error');
      return;
    }
    
    // Process QR code - in real implementation, this would decode the QR
    // For now, we'll treat it as a customer identifier
    this.findCustomerByQR(qrCode);
  }

  findCustomerByQR(qrCode) {
    // In a real system, QR codes would contain customer ID or email
    // For demo purposes, we'll search by various identifiers
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    
    // Try to find customer by different methods
    let customer = users.find(user => 
      user.id === qrCode || 
      user.email === qrCode || 
      user.studentId === qrCode ||
      user.name.toLowerCase().includes(qrCode.toLowerCase())
    );
    
    if (customer && customer.pfandData && customer.pfandData.cupsOutstanding > 0) {
      this.closeQRModal();
      this.confirmCupReturn(customer);
    } else if (customer) {
      this.closeQRModal();
      this.showNotification(`${customer.name} has no outstanding cups`, 'info');
    } else {
      this.showNotification('Customer not found or no outstanding cups', 'error');
    }
  }

  showSearchModal() {
    document.getElementById('searchModal').style.display = 'block';
    document.getElementById('searchInput').focus();
  }

  closeSearchModal() {
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').style.display = 'none';
  }

  searchCustomers(query) {
    if (query.length < 2) {
      document.getElementById('searchResults').style.display = 'none';
      return;
    }

    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const results = users.filter(user => 
      user.pfandData && user.pfandData.cupsOutstanding > 0 &&
      (user.name.toLowerCase().includes(query.toLowerCase()) ||
       user.email.toLowerCase().includes(query.toLowerCase()) ||
       (user.studentId && user.studentId.includes(query)))
    );

    this.renderSearchResults(results);
  }

  renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    
    if (results.length === 0) {
      container.innerHTML = '<div class="search-result-item">No customers found</div>';
    } else {
      container.innerHTML = results.map(customer => `
        <div class="search-result-item" onclick="orderDisplay.selectCustomer('${customer.email}')">
          <div style="font-weight: 600; color: #d4a574;">${customer.name}</div>
          <div style="font-size: 0.9rem; color: #999;">${customer.email} • ${customer.pfandData.cupsOutstanding} cup${customer.pfandData.cupsOutstanding > 1 ? 's' : ''}</div>
        </div>
      `).join('');
    }
    
    container.style.display = 'block';
  }

  selectCustomer(email) {
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const customer = users.find(user => user.email === email);
    
    if (customer) {
      this.closeSearchModal();
      this.confirmCupReturn(customer);
    }
  }

  quickSearch(query) {
    if (query.length < 2) return;
    
    const users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    const results = users.filter(user => 
      user.pfandData && user.pfandData.cupsOutstanding > 0 &&
      (user.name.toLowerCase().includes(query.toLowerCase()) ||
       user.email.toLowerCase().includes(query.toLowerCase()) ||
       (user.studentId && user.studentId.includes(query)))
    );

    if (results.length === 1) {
      // Auto-select if only one result
      this.confirmCupReturn(results[0]);
      document.getElementById('quickSearch').value = '';
    } else if (results.length > 1) {
      // Show quick results
      this.renderQuickSearchResults(results);
    }
  }

  renderQuickSearchResults(results) {
    // Create a simple dropdown for quick search
    const container = document.getElementById('quickSearch').parentElement;
    let dropdown = document.getElementById('quickSearchDropdown');
    
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'quickSearchDropdown';
      dropdown.className = 'search-results';
      container.appendChild(dropdown);
    }
    
    dropdown.innerHTML = results.slice(0, 5).map(customer => `
      <div class="search-result-item" onclick="orderDisplay.confirmCupReturn(orderDisplay.getUserByEmail('${customer.email}'))">
        <div style="font-weight: 600; color: #d4a574;">${customer.name}</div>
        <div style="font-size: 0.9rem; color: #999;">${customer.pfandData.cupsOutstanding} cup${customer.pfandData.cupsOutstanding > 1 ? 's' : ''}</div>
      </div>
    `).join('');
    
    dropdown.style.display = 'block';
    
    // Hide dropdown when clicking outside
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      }, { once: true });
    }, 100);
  }

  confirmCupReturn(customer) {
    if (!customer || !customer.pfandData || customer.pfandData.cupsOutstanding === 0) {
      this.showNotification('Customer has no outstanding cups', 'info');
      return;
    }

    const cups = customer.pfandData.cupsOutstanding;
    const deposit = cups * 2.00;
    
    if (confirm(`Confirm cup return:\n\n${customer.name}\n${cups} cup${cups > 1 ? 's' : ''}\n€${deposit.toFixed(2)} deposit to return`)) {
      this.markCupsReturned(customer.email);
      
      // Hide any search dropdowns
      const dropdown = document.getElementById('quickSearchDropdown');
      if (dropdown) dropdown.style.display = 'none';
      document.getElementById('quickSearch').value = '';
    }
  }

  // Notification Functions
  async sendOrderReadyNotification(order) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.log('❌ Cannot send notification - permission not granted');
      return;
    }

    const customerName = order.customer ? order.customer.name : 'Customer';
    const itemNames = order.items ? order.items.map(item => item.name).join(', ') : 'your order';
    
    const notification = new Notification('Order Ready! ☕', {
      body: `Hi ${customerName}! Your order (${itemNames}) is ready for pickup.`,
      icon: '/assets/icon-192x192.png',
      badge: '/assets/badge-72x72.png',
      tag: `order-${order.id}`,
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

    console.log(`📱 Order ready notification sent for order #${order.id}`);
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadOrders();
      this.renderOrders();
      this.updateRefreshTimer();
    }, 1000); // Check every second for updates
  }

  updateRefreshTimer() {
    const timerElement = document.getElementById('refreshTimer');
    if (timerElement) {
      timerElement.textContent = `${this.refreshTimer}s`;
      this.refreshTimer--;
      
      if (this.refreshTimer <= 0) {
        this.refreshTimer = 30;
      }
    }
  }

  setupEventListeners() {
    // Listen for storage changes (when new orders are added from other tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'kcafe_order_queue') {
        this.loadOrders();
        this.renderOrders();
      }
    });
  }

  playNotificationSound() {
    // Create a simple notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }

  showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.orderDisplay = new OrderDisplay();
});
