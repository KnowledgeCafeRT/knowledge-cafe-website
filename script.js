// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger && navMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
  }));
}

// Smooth scrolling for in-page navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Navbar background change and size reduction on scroll
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  if (window.scrollY > 100) {
    navbar.classList.add('scrolled');
    navbar.style.background = 'rgba(255, 255, 255, 0.98)';
    navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
  } else {
    navbar.classList.remove('scrolled');
    navbar.style.background = 'rgba(255, 255, 255, 0.95)';
    navbar.style.boxShadow = 'none';
  }
});

// Fade in animation on scroll
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  const elementsToAnimate = document.querySelectorAll('.about-card, .menu-category, .event-card, .contact-item, .contact-form');
  elementsToAnimate.forEach(el => { el.classList.add('fade-in'); observer.observe(el); });
});

// Notification system
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `position: fixed; top: 100px; right: 20px; background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'}; color: white; padding: 1rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 10000; transform: translateX(400px); transition: transform 0.3s ease; max-width: 400px;`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 50);
  setTimeout(() => { notification.style.transform = 'translateX(400px)'; setTimeout(() => notification.remove(), 300); }, 5000);
}

// Navigation State Management
class NavigationManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    this.loadCurrentUser();
    this.updateNavigation();
  }

  async loadCurrentUser() {
    // Check localStorage first
    const userData = localStorage.getItem('kcafe_current_user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }

    // Also check Supabase session if available
    if (typeof window.supabase !== 'undefined' && typeof window.getSupabaseClient === 'function') {
      try {
        const supabase = await window.getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            this.currentUser = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
            };
          }
        }
      } catch (error) {
        console.log('Supabase not available or error checking session:', error);
      }
    }
  }

  updateNavigation() {
    const profileLinks = document.querySelectorAll('.profile-link');
    profileLinks.forEach(link => {
      if (this.currentUser) {
        // User is logged in - show profile link
        link.href = '/profile.html';
        const span = link.querySelector('span');
        if (span) {
          span.textContent = this.currentUser.name;
        }
        const icon = link.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-user-circle';
        }
      } else {
        // User is not logged in - show login link
        link.href = '/login.html';
        const span = link.querySelector('span');
        if (span) {
          span.textContent = 'Login';
        }
        const icon = link.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-user';
        }
      }
    });

    // Update login link in navigation (for index.html style navigation)
    const navLoginLink = document.getElementById('navLoginLink');
    if (navLoginLink) {
      if (this.currentUser) {
        navLoginLink.href = 'profile.html';
        navLoginLink.textContent = 'profile';
      } else {
        navLoginLink.href = 'login.html';
        navLoginLink.textContent = 'login';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { 
  const navManager = new NavigationManager();
  
  // Update navigation periodically to catch login/logout events
  setInterval(() => {
    navManager.loadCurrentUser();
    navManager.updateNavigation();
  }, 2000);
  
  // Listen for storage changes (login/logout from other tabs)
  window.addEventListener('storage', () => {
    navManager.loadCurrentUser();
    navManager.updateNavigation();
  });
});

console.log('☕ Knowledge Café front-end loaded.');
P