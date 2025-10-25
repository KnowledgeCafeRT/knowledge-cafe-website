// Authentication and User Management
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    this.init();
  }

  init() {
    this.loadCurrentUser();
    this.setupEventListeners();
    this.checkAuthState();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Form submissions
    document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update forms
    document.querySelectorAll('.auth-form').forEach(form => {
      form.classList.toggle('active', form.id === `${tabName}Form`);
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const user = this.authenticateUser(email, password);
      if (user) {
        this.setCurrentUser(user);
        this.showNotification('Welcome back!', 'success');
        setTimeout(() => {
          window.location.href = '/profile.html';
        }, 1000);
      } else {
        this.showNotification('Invalid email or password', 'error');
      }
    } catch (error) {
      this.showNotification('Login failed. Please try again.', 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const studentId = document.getElementById('registerStudentId').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (password !== confirmPassword) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }

    if (this.users.find(u => u.email === email)) {
      this.showNotification('Email already registered', 'error');
      return;
    }

    try {
      const user = this.createUser(name, email, studentId, password);
      this.users.push(user);
      this.saveUsers();
      this.setCurrentUser(user);
      this.showNotification('Account created successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 1000);
    } catch (error) {
      this.showNotification('Registration failed. Please try again.', 'error');
    }
  }

  createUser(name, email, studentId, password) {
    return {
      id: this.generateUserId(),
      name,
      email,
      studentId,
      password: this.hashPassword(password), // Simple hash for demo
      createdAt: new Date().toISOString(),
      loyaltyVisits: 0,
      totalOrders: 0,
      totalSpent: 0,
      rewardsEarned: 0,
      orders: [],
      preferences: {
        defaultRole: 'student',
        emailNotifications: true,
        loyaltyReminders: true
      }
    };
  }

  authenticateUser(email, password) {
    const user = this.users.find(u => u.email === email);
    if (user && user.password === this.hashPassword(password)) {
      return user;
    }
    return null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    localStorage.setItem('kcafe_current_user', JSON.stringify(user));
  }

  loadCurrentUser() {
    const userData = localStorage.getItem('kcafe_current_user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }
  }

  checkAuthState() {
    if (this.currentUser) {
      // Redirect to profile if already logged in
      if (window.location.pathname === '/login.html') {
        window.location.href = '/profile.html';
      }
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('kcafe_current_user');
    window.location.href = '/login.html';
  }

  saveUsers() {
    localStorage.setItem('kcafe_users', JSON.stringify(this.users));
  }

  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  hashPassword(password) {
    // Simple hash for demo purposes - in production use proper hashing
    return btoa(password + 'kcafe_salt');
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
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthManager();
});
