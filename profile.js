// Profile Management
class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    this.init();
  }

  init() {
    this.loadCurrentUser();
    if (!this.currentUser) {
      window.location.href = '/login.html';
      return;
    }
    this.setupEventListeners();
    this.renderProfile();
    this.loadCurrentOrder();
    this.loadOrderHistory();
    this.loadLoyaltyCard();
    this.loadPfandData();
    this.loadProfileImage();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

    // Add visit
    document.getElementById('addVisitBtn')?.addEventListener('click', () => this.addLoyaltyVisit());

    // Form submissions
    document.getElementById('profileForm')?.addEventListener('submit', (e) => this.updateProfile(e));
    document.getElementById('preferencesForm')?.addEventListener('submit', (e) => this.updatePreferences(e));

    // Delete account
    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.deleteAccount());

    // Order filter
    document.getElementById('orderFilter')?.addEventListener('change', (e) => this.filterOrders(e.target.value));

    // Avatar upload
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarInput')?.addEventListener('change', (e) => this.handleAvatarUpload(e));

    // Pfand return
  }

  loadCurrentUser() {
    const userData = localStorage.getItem('kcafe_current_user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }
  }

  renderProfile() {
    // Update profile header
    document.getElementById('profileName').textContent = this.currentUser.name;
    document.getElementById('profileEmail').textContent = this.currentUser.email;
    document.getElementById('memberSince').textContent = new Date(this.currentUser.createdAt).toLocaleDateString();
    document.getElementById('userName').textContent = this.currentUser.name;

    // Update stats
    document.getElementById('totalOrders').textContent = this.currentUser.totalOrders || 0;
    document.getElementById('loyaltyVisits').textContent = this.currentUser.loyaltyVisits || 0;
    document.getElementById('totalSpent').textContent = `€${(this.currentUser.totalSpent || 0).toFixed(2)}`;
    document.getElementById('rewardsEarned').textContent = this.currentUser.rewardsEarned || 0;

    // Update settings form
    document.getElementById('settingsName').value = this.currentUser.name;
    document.getElementById('settingsEmail').value = this.currentUser.email;
    document.getElementById('settingsStudentId').value = this.currentUser.studentId || '';
    document.getElementById('defaultRole').value = this.currentUser.preferences?.defaultRole || 'student';
    document.getElementById('emailNotifications').checked = this.currentUser.preferences?.emailNotifications || false;
    document.getElementById('loyaltyReminders').checked = this.currentUser.preferences?.loyaltyReminders || false;
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.profile-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load content for specific tabs
    if (tabName === 'current') {
      this.loadCurrentOrder();
    } else if (tabName === 'pfand') {
      this.loadPfandData();
    }
  }

  loadCurrentOrder() {
    const currentOrderContent = document.getElementById('currentOrderContent');
    const cart = JSON.parse(localStorage.getItem('kcafe_cart_v1')) || {};

    if (Object.keys(cart).length === 0) {
      currentOrderContent.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shopping-cart"></i>
          <h3>No items in cart</h3>
          <p>Add some items to your order to see them here</p>
          <a href="/order.html" class="btn btn-primary">Start Ordering</a>
        </div>
      `;
      return;
    }

    let subtotal = 0;
    const cartItems = Object.entries(cart).map(([id, item]) => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      return `
        <div class="cart-item">
          <div class="item-info">
            <h4>${item.name}</h4>
            <span class="item-quantity">Qty: ${item.qty}</span>
          </div>
          <div class="item-price">€${itemTotal.toFixed(2)}</div>
        </div>
      `;
    }).join('');

    const taxRate = 0.05;
    const taxes = subtotal * taxRate;
    const total = subtotal + taxes;

    currentOrderContent.innerHTML = `
      <div class="current-order-card">
        <div class="order-items">
          ${cartItems}
        </div>
        <div class="order-summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>€${subtotal.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Taxes</span>
            <span>€${taxes.toFixed(2)}</span>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <span>€${total.toFixed(2)}</span>
          </div>
        </div>
        <div class="order-actions">
          <a href="/order.html" class="btn btn-secondary">
            <i class="fas fa-edit"></i>
            Edit Order
          </a>
          <a href="/checkout.html" class="btn btn-primary">
            <i class="fas fa-credit-card"></i>
            Checkout
          </a>
        </div>
      </div>
    `;
  }

  loadOrderHistory() {
    const ordersList = document.getElementById('ordersList');
    const orders = this.currentUser.orders || [];

    if (orders.length === 0) {
      ordersList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <h3>No orders yet</h3>
          <p>Start your first order to see your history here</p>
          <a href="/order.html" class="btn btn-primary">Place Order</a>
        </div>
      `;
      return;
    }

    ordersList.innerHTML = orders.map(order => `
      <div class="order-card">
        <div class="order-header">
          <div class="order-info">
            <h4>Order #${order.id}</h4>
            <span class="order-date">${new Date(order.date).toLocaleDateString()}</span>
          </div>
          <div class="order-status">
            <span class="status-badge ${order.status}">${order.status}</span>
          </div>
        </div>
        <div class="order-items">
          ${order.items.map(item => `
            <div class="order-item">
              <span class="item-name">${item.name} x${item.quantity}</span>
              <span class="item-price">€${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-footer">
          <div class="order-total">
            <span>Total: €${order.total.toFixed(2)}</span>
          </div>
          <div class="order-actions">
            <button class="btn btn-secondary btn-sm" onclick="profileManager.reorder(${order.id})">
              <i class="fas fa-redo"></i>
              Reorder
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  loadLoyaltyCard() {
    const visits = this.currentUser.loyaltyVisits || 0;
    const maxVisits = 10;

    // Update progress
    document.getElementById('loyaltyProgressText').textContent = `${visits} / ${maxVisits} visits`;
    const progressFill = document.getElementById('loyaltyProgressFill');
    progressFill.style.width = `${(visits / maxVisits) * 100}%`;

    // Generate stamps
    const stampGrid = document.getElementById('loyaltyStampGrid');
    stampGrid.innerHTML = '';
    for (let i = 0; i < maxVisits; i++) {
      const stamp = document.createElement('div');
      stamp.className = `stamp ${i < visits ? 'filled' : ''}`;
      stamp.innerHTML = '<i class="fas fa-coffee"></i>';
      stampGrid.appendChild(stamp);
    }

    // Update reward status
    const rewardStatus = document.getElementById('rewardStatus');
    const freeCoffeeReward = document.getElementById('freeCoffeeReward');
    
    if (visits >= maxVisits) {
      rewardStatus.textContent = 'Available';
      rewardStatus.className = 'reward-status available';
      freeCoffeeReward.classList.add('available');
    } else {
      rewardStatus.textContent = `${maxVisits - visits} more visits needed`;
      rewardStatus.className = 'reward-status';
      freeCoffeeReward.classList.remove('available');
    }
  }

  addLoyaltyVisit() {
    this.currentUser.loyaltyVisits = (this.currentUser.loyaltyVisits || 0) + 1;
    this.saveUser();
    this.loadLoyaltyCard();
    this.renderProfile();
    this.showNotification('Visit added to your loyalty card!', 'success');
  }

  filterOrders(filter) {
    // Implementation for filtering orders
    this.loadOrderHistory(); // For now, just reload all orders
  }

  updateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('settingsName').value;
    const email = document.getElementById('settingsEmail').value;
    const studentId = document.getElementById('settingsStudentId').value;

    this.currentUser.name = name;
    this.currentUser.email = email;
    this.currentUser.studentId = studentId;

    this.saveUser();
    this.renderProfile();
    this.showNotification('Profile updated successfully!', 'success');
  }

  updatePreferences(e) {
    e.preventDefault();
    const defaultRole = document.getElementById('defaultRole').value;
    const emailNotifications = document.getElementById('emailNotifications').checked;
    const loyaltyReminders = document.getElementById('loyaltyReminders').checked;

    this.currentUser.preferences = {
      ...this.currentUser.preferences,
      defaultRole,
      emailNotifications,
      loyaltyReminders
    };

    this.saveUser();
    this.showNotification('Preferences updated successfully!', 'success');
  }

  reorder(orderId) {
    const order = this.currentUser.orders.find(o => o.id === orderId);
    if (order) {
      // Save order items to cart
      const cart = {};
      order.items.forEach(item => {
        cart[item.id] = {
          name: item.name,
          price: item.price,
          qty: item.quantity
        };
      });
      localStorage.setItem('kcafe_cart_v1', JSON.stringify(cart));
      window.location.href = '/order.html';
    }
  }

  deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Remove user from users array
      this.users = this.users.filter(u => u.id !== this.currentUser.id);
      localStorage.setItem('kcafe_users', JSON.stringify(this.users));
      
      // Clear current user
      localStorage.removeItem('kcafe_current_user');
      
      this.showNotification('Account deleted successfully', 'success');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1000);
    }
  }

  logout() {
    localStorage.removeItem('kcafe_current_user');
    window.location.href = '/login.html';
  }

  saveUser() {
    // Update user in users array
    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    if (userIndex !== -1) {
      this.users[userIndex] = this.currentUser;
      localStorage.setItem('kcafe_users', JSON.stringify(this.users));
    }
    
    // Update current user
    localStorage.setItem('kcafe_current_user', JSON.stringify(this.currentUser));
  }

  loadProfileImage() {
    const profileImage = document.getElementById('profileImage');
    const defaultAvatar = document.getElementById('defaultAvatar');
    
    if (this.currentUser.profileImage) {
      profileImage.src = this.currentUser.profileImage;
      profileImage.style.display = 'block';
      defaultAvatar.style.display = 'none';
    } else {
      profileImage.style.display = 'none';
      defaultAvatar.style.display = 'block';
    }
  }

  handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      this.showNotification('Image size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentUser.profileImage = e.target.result;
      this.saveUser();
      this.loadProfileImage();
      this.showNotification('Profile picture updated successfully!', 'success');
    };
    reader.readAsDataURL(file);
  }

  loadPfandData() {
    const pfandData = this.currentUser.pfandData || {
      cupsOutstanding: 0,
      cupsReturned: 0,
      totalDepositPaid: 0,
      totalDepositReturned: 0,
      activity: []
    };

    // Update stats
    document.getElementById('cupsOutstanding').textContent = pfandData.cupsOutstanding;
    document.getElementById('pfandValue').textContent = `€${(pfandData.cupsOutstanding * 2.00).toFixed(2)}`;
    document.getElementById('cupsReturned').textContent = pfandData.cupsReturned;

    // Generate QR code
    this.generateQRCode();

    // Update activity list
    const activityList = document.getElementById('pfandActivityList');
    if (pfandData.activity.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-recycle"></i>
          <h3>No Pfand activity yet</h3>
          <p>Your Pfand cup activity will appear here</p>
        </div>
      `;
    } else {
      activityList.innerHTML = pfandData.activity.slice(0, 10).map(activity => `
        <div class="pfand-activity-item">
          <div class="activity-icon">
            <i class="fas fa-${activity.type === 'deposit' ? 'plus' : 'minus'}"></i>
          </div>
          <div class="activity-details">
            <h4>${activity.type === 'deposit' ? 'Cup Deposit' : 'Cup Return'}</h4>
            <p>${activity.description}</p>
            <span class="activity-date">${new Date(activity.date).toLocaleDateString()}</span>
          </div>
          <div class="activity-amount ${activity.type}">
            ${activity.type === 'deposit' ? '+' : '-'}€${activity.amount.toFixed(2)}
          </div>
        </div>
      `).join('');
    }
  }


  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  generateQRCode() {
    const qrContainer = document.getElementById('qrCodeDisplay');
    if (!qrContainer) return;

    // Create QR code data - in a real system, this would be a unique customer ID
    const qrData = {
      type: 'pfand_return',
      customerId: this.currentUser.id,
      email: this.currentUser.email,
      name: this.currentUser.name
    };

    const qrText = JSON.stringify(qrData);

    // Primary: use a hosted QR image (no scripts needed)
    const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
    const img = new Image();
    img.width = 200;
    img.height = 200;
    img.alt = 'Pfand return QR';
    img.onload = () => {
      qrContainer.innerHTML = '';
      qrContainer.appendChild(img);
    };
    img.onerror = () => {
      // Fallback to local library if available
      if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        qrContainer.innerHTML = '';
        try {
          const canvas = document.createElement('canvas');
          qrContainer.appendChild(canvas);
          window.QRCode.toCanvas(canvas, qrText, { width: 200, margin: 1 }, (error) => {
            if (error) {
              throw error;
            }
          });
        } catch (err) {
          console.error('QR generation failed:', err);
          qrContainer.textContent = qrText;
        }
      } else {
        // Final fallback: show raw text
        qrContainer.textContent = qrText;
      }
    };
    // Trigger load
    img.src = imgUrl;
  }
}

// Global instance for reorder function
let profileManager;

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  profileManager = new ProfileManager();
});
