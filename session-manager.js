// Session Manager - Handles user authentication and session persistence
class SessionManager {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.init();
  }

  async init() {
    // Wait for Supabase to be available
    if (typeof window.supabase === 'undefined') {
      // Wait a bit and try again
      setTimeout(() => this.init(), 100);
      return;
    }

    const supabase = await window.getSupabaseClient();
    if (!supabase) return;

    // Check for existing session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session && !error) {
      this.currentUser = session.user;
      await this.loadUserProfile(session.user.id);
      this.onSessionChange(true);
    } else {
      this.onSessionChange(false);
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.currentUser = session.user;
        await this.loadUserProfile(session.user.id);
        this.onSessionChange(true);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.userProfile = null;
        this.onSessionChange(false);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        this.currentUser = session.user;
      }
    });
  }

  async loadUserProfile(userId) {
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) return;

      // Try to get user from users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        this.userProfile = data;
      } else {
        // If user doesn't exist in users table, create basic profile from auth
        this.userProfile = {
          id: this.currentUser.id,
          email: this.currentUser.email,
          name: this.currentUser.user_metadata?.name || this.currentUser.email,
          user_type: this.currentUser.user_metadata?.user_type || 'student'
        };
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Fallback to basic profile
      if (this.currentUser) {
        this.userProfile = {
          id: this.currentUser.id,
          email: this.currentUser.email,
          name: this.currentUser.user_metadata?.name || this.currentUser.email,
          user_type: this.currentUser.user_metadata?.user_type || 'student'
        };
      }
    }
  }

  async signIn(email, password) {
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Log failed login attempt
        await this.logAuthAction(email, 'login_failed', error.message);
        throw error;
      }

      if (data.session) {
        this.currentUser = data.user;
        await this.loadUserProfile(data.user.id);
        
        // Log successful login
        await this.logAuthAction(email, 'login_success', null, data.user.id);
        
        return { success: true, user: data.user };
      }

      return { success: false, error: 'No session created' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async signUp(email, password, name, userType = 'student', studentId = null) {
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            user_type: userType,
            student_id: studentId
          }
        }
      });

      if (authError) throw authError;

      // Create user profile in users table
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            name,
            student_id: studentId,
            user_type: userType
          });

        if (profileError && !profileError.message.includes('duplicate')) {
          console.error('Error creating user profile:', profileError);
        }

        this.currentUser = authData.user;
        await this.loadUserProfile(authData.user.id);
        
        // Log signup (trigger will also log, but this ensures it happens)
        await this.logAuthAction(email, 'signup', null, authData.user.id);
        
        return { success: true, user: authData.user };
      }

      return { success: false, error: 'User creation failed' };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const supabase = await window.getSupabaseClient();
      const userId = this.currentUser?.id;
      const email = this.currentUser?.email || this.userProfile?.email;
      
      if (supabase) {
        await supabase.auth.signOut();
      }
      
      // Log logout
      if (email) {
        await this.logAuthAction(email, 'logout', null, userId);
      }
      
      this.currentUser = null;
      this.userProfile = null;
      this.onSessionChange(false);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  async logAuthAction(email, action, errorMessage = null, userId = null) {
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) return;

      // Get IP address and user agent if available
      const ipAddress = null; // Can be set from request headers if available
      const userAgent = navigator.userAgent || null;

      const { error } = await supabase
        .from('auth_logs')
        .insert({
          user_id: userId,
          email: email,
          action: action,
          ip_address: ipAddress,
          user_agent: userAgent,
          error_message: errorMessage
        });

      if (error) {
        console.error('Error logging auth action:', error);
      }
    } catch (error) {
      console.error('Error in logAuthAction:', error);
      // Don't throw - logging failures shouldn't break auth flow
    }
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  getUser() {
    return this.currentUser;
  }

  getUserProfile() {
    return this.userProfile;
  }

  getUserType() {
    return this.userProfile?.user_type || 'student';
  }

  getUserEmail() {
    return this.userProfile?.email || this.currentUser?.email || '';
  }

  getUserName() {
    return this.userProfile?.name || this.currentUser?.user_metadata?.name || '';
  }

  onSessionChange(isAuthenticated) {
    // Dispatch custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('kcafe_session_change', {
      detail: {
        isAuthenticated,
        user: this.currentUser,
        profile: this.userProfile
      }
    }));

    // Update UI elements
    this.updateNavigationUI();
  }

  updateNavigationUI() {
    // Update login/profile link in navigation
    const profileLinks = document.querySelectorAll('.profile-link');
    profileLinks.forEach(link => {
      if (this.isAuthenticated()) {
        link.innerHTML = `
          <i class="fas fa-user-circle"></i>
          <span>${this.getUserName()}</span>
        `;
        link.href = '/profile.html';
      } else {
        link.innerHTML = `
          <i class="fas fa-user"></i>
          <span>Login</span>
        `;
        link.href = '/login.html';
      }
    });
  }
}

// Initialize global session manager
window.sessionManager = new SessionManager();

