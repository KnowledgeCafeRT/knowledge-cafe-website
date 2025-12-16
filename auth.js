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
    this.loadSavedEmail(); // Load saved email if "remember me" was checked
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
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update forms - map tab names to form IDs
    const formIdMap = {
      'login': 'loginForm',
      'register': 'registerForm'
    };
    const expectedFormId = formIdMap[tabName];
    
    document.querySelectorAll('.auth-form').forEach(form => {
      if (form.id === expectedFormId) {
        form.classList.add('active');
      } else {
        form.classList.remove('active');
      }
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!email || !password) {
      this.showNotification('Please enter both email and password', 'error');
      return;
    }

    // Save email if "remember me" is checked (NEVER save password)
    if (rememberMe) {
      localStorage.setItem('kcafe_saved_email', email);
    } else {
      localStorage.removeItem('kcafe_saved_email');
    }

    try {
      // Try Supabase Auth first
      if (window.sessionManager) {
        const result = await window.sessionManager.signIn(email, password);
        if (result.success) {
          this.showNotification('Welcome back!', 'success');
          setTimeout(() => {
            window.location.href = '/profile.html';
          }, 1000);
          return;
        } else {
          this.showNotification(result.error || 'Invalid email or password', 'error');
          return;
        }
      }
      
      // Fallback to localStorage auth
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
      console.error('Login error:', error);
      this.showNotification('Login failed. Please try again.', 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName')?.value;
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const studentId = document.getElementById('registerStudentId')?.value || null;
    const userType = document.querySelector('input[name="userType"]:checked')?.value || 'student';

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      this.showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      // Try Supabase Auth first
      if (window.sessionManager) {
        const result = await window.sessionManager.signUp(email, password, name, userType, studentId);
        if (result.success) {
          this.showNotification('Account created successfully!', 'success');
          setTimeout(() => {
            window.location.href = '/profile.html';
          }, 1000);
          return;
        } else {
          this.showNotification(result.error || 'Registration failed', 'error');
          return;
        }
      }
      
      // Fallback to localStorage auth
      if (this.users.find(u => u.email === email)) {
        this.showNotification('Email already registered', 'error');
        return;
      }

      const user = this.createUser(name, email, studentId, password);
      this.users.push(user);
      this.saveUsers();
      this.setCurrentUser(user);
      this.showNotification('Account created successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 1000);
    } catch (error) {
      console.error('Registration error:', error);
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
    // Check Supabase session first
    if (window.sessionManager && window.sessionManager.isAuthenticated()) {
      // Redirect to profile if already logged in
      if (window.location.pathname === '/login.html') {
        window.location.href = '/profile.html';
      }
      return;
    }
    
    // Fallback to localStorage
    if (this.currentUser) {
      // Redirect to profile if already logged in
      if (window.location.pathname === '/login.html') {
        window.location.href = '/profile.html';
      }
    }
  }

  async logout() {
    // Try Supabase logout first
    if (window.sessionManager && window.sessionManager.isAuthenticated()) {
      await window.sessionManager.signOut();
      window.location.href = '/index.html';
      return;
    }
    
    // Fallback to localStorage logout
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

  loadSavedEmail() {
    const savedEmail = localStorage.getItem('kcafe_saved_email');
    if (savedEmail) {
      const emailInput = document.getElementById('loginEmail');
      if (emailInput) {
        emailInput.value = savedEmail;
        // Check the "remember me" checkbox if email was saved
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) {
          rememberMeCheckbox.checked = true;
        }
      }
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
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for sessionManager to initialize
  setTimeout(() => {
    const authManager = new AuthManager();
    window.authManager = authManager; // Make it globally available for debugging
  }, 100);
});
