// Order Tracking System
class OrderTracker {
  constructor() {
    this.currentOrder = null;
    this.refreshInterval = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadRecentOrders();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    const form = document.getElementById('trackingForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.trackOrder();
    });

    // Auto-focus search input
    const searchInput = document.getElementById('orderNumber');
    searchInput.focus();
  }

  trackOrder() {
    const orderNumber = document.getElementById('orderNumber').value.trim();
    
    if (!orderNumber) {
      this.showError('Please enter an order number');
      return;
    }

    // Clean order number (remove # if present)
    const cleanOrderNumber = orderNumber.replace('#', '');
    
    // Get order from localStorage
    const orders = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const order = orders.find(o => o.id === cleanOrderNumber || o.id === orderNumber);
    
    if (order) {
      this.currentOrder = order;
      this.displayOrder(order);
      this.hideNoOrderFound();
      this.showOrderTracking();
    } else {
      this.showNoOrderFound();
      this.hideOrderTracking();
    }
  }

  displayOrder(order) {
    // Update order info
    document.getElementById('trackingOrderNumber').textContent = `#${order.id}`;
    document.getElementById('trackingOrderTime').textContent = 
      `Placed at ${new Date(order.createdAt).toLocaleTimeString()}`;

    // Update order items
    this.displayOrderItems(order.items || []);

    // Update status timeline
    this.updateStatusTimeline(order);

    // Update estimated time
    this.updateEstimatedTime(order);
  }

  displayOrderItems(items) {
    const container = document.getElementById('trackingOrderItems');
    
    if (items.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #5c4033;">No items found</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="order-item">
        <div class="item-details">
          <h4>${item.name}</h4>
          <p>Quantity: ${item.qty} • ${item.pfand ? 'With Pfand Cup' : 'Regular Cup'}</p>
        </div>
        <div class="item-price">€${(item.price * item.qty).toFixed(2)}</div>
      </div>
    `).join('');
  }

  updateStatusTimeline(order) {
    const timeline = document.getElementById('statusTimeline');
    const status = order.status || 'pending';
    
    const statuses = [
      {
        key: 'pending',
        title: 'Order Received',
        description: 'Your order has been received and is being prepared',
        icon: 'fas fa-check-circle'
      },
      {
        key: 'preparing',
        title: 'Preparing',
        description: 'Our baristas are crafting your order',
        icon: 'fas fa-coffee'
      },
      {
        key: 'ready',
        title: 'Ready for Pickup',
        description: 'Your order is ready! Please come to the counter',
        icon: 'fas fa-bell'
      },
      {
        key: 'collected',
        title: 'Collected',
        description: 'Order has been picked up',
        icon: 'fas fa-check-double'
      }
    ];

    timeline.innerHTML = statuses.map((statusItem, index) => {
      const isCompleted = this.isStatusCompleted(status, statusItem.key);
      const isCurrent = status === statusItem.key;
      const statusClass = isCompleted ? 'completed' : (isCurrent ? 'current' : '');
      
      return `
        <div class="timeline-item ${statusClass}">
          <div class="timeline-content">
            <h3><i class="${statusItem.icon}"></i> ${statusItem.title}</h3>
            <p>${statusItem.description}</p>
            ${isCompleted ? `<div class="timeline-time">Completed at ${this.getStatusTime(order, statusItem.key)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  isStatusCompleted(currentStatus, checkStatus) {
    const statusOrder = ['pending', 'preparing', 'ready', 'collected'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const checkIndex = statusOrder.indexOf(checkStatus);
    return checkIndex <= currentIndex;
  }

  getStatusTime(order, status) {
    // In a real system, you'd track when each status was reached
    const now = new Date();
    const orderTime = new Date(order.createdAt);
    const timeDiff = now - orderTime;
    
    if (status === 'pending') return orderTime.toLocaleTimeString();
    if (status === 'preparing') return new Date(orderTime.getTime() + 2 * 60000).toLocaleTimeString();
    if (status === 'ready') return new Date(orderTime.getTime() + 5 * 60000).toLocaleTimeString();
    if (status === 'collected') return new Date(orderTime.getTime() + 7 * 60000).toLocaleTimeString();
    
    return 'Just now';
  }

  updateEstimatedTime(order) {
    const status = order.status || 'pending';
    const orderTime = new Date(order.createdAt);
    const now = new Date();
    const timeDiff = now - orderTime;
    
    let estimatedTime = '5-7 minutes';
    
    if (status === 'ready') {
      estimatedTime = 'Ready now!';
    } else if (status === 'collected') {
      estimatedTime = 'Order completed';
    } else if (status === 'preparing') {
      const remaining = Math.max(0, 5 - Math.floor(timeDiff / 60000));
      estimatedTime = `${remaining} minutes remaining`;
    }
    
    document.getElementById('estimatedTimeText').textContent = estimatedTime;
  }

  loadRecentOrders() {
    const orders = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const recentOrders = orders
      .filter(order => order.customer && order.customer.email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    if (recentOrders.length > 0) {
      this.displayRecentOrders(recentOrders);
      document.getElementById('recentOrders').style.display = 'block';
    }
  }

  displayRecentOrders(orders) {
    const container = document.getElementById('recentOrdersList');
    
    container.innerHTML = orders.map(order => `
      <div class="recent-order-item" onclick="orderTracker.trackOrderById('${order.id}')">
        <div class="recent-order-header">
          <div class="recent-order-number">#${order.id}</div>
          <div class="recent-order-status status-${order.status || 'pending'}">
            ${this.getStatusText(order.status || 'pending')}
          </div>
        </div>
        <div style="color: #5c4033; font-size: 0.9rem;">
          ${new Date(order.createdAt).toLocaleDateString()} at ${new Date(order.createdAt).toLocaleTimeString()}
        </div>
      </div>
    `).join('');
  }

  getStatusText(status) {
    const statusMap = {
      'pending': 'Received',
      'preparing': 'Preparing',
      'ready': 'Ready',
      'collected': 'Collected'
    };
    return statusMap[status] || 'Unknown';
  }

  trackOrderById(orderId) {
    document.getElementById('orderNumber').value = orderId;
    this.trackOrder();
  }

  startAutoRefresh() {
    // Refresh every 10 seconds if tracking an order
    this.refreshInterval = setInterval(() => {
      if (this.currentOrder) {
        this.refreshCurrentOrder();
      }
    }, 10000);
  }

  refreshCurrentOrder() {
    const orders = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const order = orders.find(o => o.id === this.currentOrder.id);
    
    if (order) {
      this.currentOrder = order;
      this.displayOrder(order);
    } else {
      // Order no longer exists (maybe collected)
      this.currentOrder = null;
      this.hideOrderTracking();
      this.showNoOrderFound();
    }
  }

  showOrderTracking() {
    document.getElementById('orderTracking').style.display = 'block';
    document.getElementById('noOrderFound').style.display = 'none';
  }

  hideOrderTracking() {
    document.getElementById('orderTracking').style.display = 'none';
  }

  showNoOrderFound() {
    document.getElementById('noOrderFound').style.display = 'block';
    document.getElementById('orderTracking').style.display = 'none';
  }

  hideNoOrderFound() {
    document.getElementById('noOrderFound').style.display = 'none';
  }

  showError(message) {
    // Simple error display - could be enhanced with toast notifications
    alert(message);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Initialize order tracker
let orderTracker;
document.addEventListener('DOMContentLoaded', () => {
  orderTracker = new OrderTracker();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (orderTracker) {
    orderTracker.destroy();
  }
});
