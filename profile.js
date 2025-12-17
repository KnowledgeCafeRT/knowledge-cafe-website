// Profile Management
class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.users = JSON.parse(localStorage.getItem('kcafe_users')) || [];
    this.redirecting = false; // Flag to prevent redirect loops
    this.init();
  }

  async init() {
    console.log('ProfileManager init started');
    // Wait for session manager to exist
    let attempts = 0;
    while (!window.sessionManager && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.sessionManager) {
      console.warn('SessionManager not found after waiting');
      // Try localStorage fallback
      await this.loadCurrentUser();
      // Remove any auto-redirect to login here!
      // if (!this.currentUser) {
      //   window.location.href = 'login.html';
      //   return;
      // }
    } else {
      // Wait for Supabase client to be ready
      let supabaseReady = false;
      attempts = 0;
      while (!supabaseReady && attempts < 50) {
        try {
          const supabase = await window.getSupabaseClient();
          if (supabase) {
            supabaseReady = true;
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      // Wait for session to be restored - check multiple times
      attempts = 0;
      while (attempts < 30) {
        if (window.sessionManager) {
          try {
            const supabase = await window.getSupabaseClient();
            if (supabase) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                await new Promise(resolve => setTimeout(resolve, 500));
                break;
              }
            }
          } catch {}
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      // Load current user
      await this.loadCurrentUser();
      // Remove any redirect code here! (See below for new, safe logic)
    }
    // ... everything else unchanged below ...
    this.setupEventListeners();
    this.renderProfile();
    this.loadCurrentOrder();
    this.loadOrderHistory();
    this.loadLoyaltyCard();
    this.loadPfandData();
    this.loadProfileImage();
  }
  // ... rest of your class as before ...
}

// Global instance for reorder function
let profileManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    profileManager = new ProfileManager();
    window.profileManager = profileManager;
    persistentSessionRedirectFix();
  });
} else {
  profileManager = new ProfileManager();
  window.profileManager = profileManager;
  persistentSessionRedirectFix();
}

// ---- NEW: Best-practice login redirect protection ----
(function persistentSessionRedirectFix() {
  let sessionRestored = false;
  let redirected = false;
  function checkAndMaybeRedirect() {
    if (redirected) return;
    if (window.sessionManager && !window.sessionManager.isAuthenticated()) {
      redirected = true;
      window.location.href = "login.html";
    }
  }
  // Listen for any supabase session hydration
  window.addEventListener("kcafe_session_change", (e) => {
    sessionRestored = true;
    setTimeout(() => {
      checkAndMaybeRedirect();
    }, 800);
  });
  // Fallback in case event never happens
  setTimeout(() => {
    if (!sessionRestored) {
      checkAndMaybeRedirect();
    }
  }, 3500); // generous grace period!!
})();
