// Simple Authentication - Just Works
class SimpleAuth {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin(e);
      });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister(e);
      });
    }

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        if (tabName === 'login') {
          document.getElementById('loginForm').classList.add('active');
          document.getElementById('registerForm').classList.remove('active');
        } else {
          document.getElementById('registerForm').classList.add('active');
          document.getElementById('loginForm').classList.remove('active');
        }
      });
    });
  }

  async handleLogin(e) {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    try {
      if (window.sessionManager) {
        const result = await window.sessionManager.signIn(email, password);
        
        if (result.success) {
          // Wait a moment to ensure session is persisted
          await new Promise(resolve => setTimeout(resolve, 500));
          alert('Welcome back!');
          window.location.href = 'profile.html';
        } else {
          alert(result.error || 'Login failed');
        }
      } else {
        alert('System not ready. Please refresh the page.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  }

  async handleRegister(e) {
    const name = document.getElementById('registerName')?.value;
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const userType = document.querySelector('input[name="userType"]:checked')?.value || 'student';
    const studentId = document.getElementById('registerStudentId')?.value || null;

    if (!name || !email || !password || !confirmPassword) {
      alert('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      if (window.sessionManager) {
        const result = await window.sessionManager.signUp(email, password, name, userType, studentId);
        
        if (result.success) {
          alert('Account created successfully!');
          window.location.href = 'profile.html';
        } else {
          alert(result.error || 'Registration failed');
        }
      } else {
        alert('System not ready. Please refresh the page.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait for session manager
  setTimeout(() => {
    new SimpleAuth();
  }, 500);
});

