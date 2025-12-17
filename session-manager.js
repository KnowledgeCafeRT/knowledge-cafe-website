// Session Manager - Handles user authentication and session persistence
class SessionManager {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.init();
  }

  async init() {
    console.log('SessionManager.init() called');
    
    // Wait for Supabase to be available - try multiple times
    let attempts = 0;
    while (typeof window.supabase === 'undefined' && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window.supabase === 'undefined') {
      console.warn('Supabase library not loaded after waiting');
      this.onSessionChange(false);
      return;
    }

    // Wait for getSupabaseClient to be available
    attempts = 0;
    while (typeof window.getSupabaseClient === 'undefined' && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    const supabase = await window.getSupabaseClient();
    if (!supabase) {
      console.warn('Failed to get Supabase client');
      this.onSessionChange(false);
      return;
    }

    console.log('Supabase client ready, checking session...');

    // Check for existing session
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('Session check result:', { hasSession: !!session, error });
      
      if (session && !error && session.user) {
        console.log('Session found, loading user profile...');
        this.currentUser = session.user;
        await this.loadUserProfile(session.user.id);
        this.onSessionChange(true);
      } else {
        console.log('No active session found');
        this.onSessionChange(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      this.onSessionChange(false);
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
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
      } else if (event === 'INITIAL_SESSION' && session) {
        // Handle initial session restoration
        this.currentUser = session.user;
        await this.loadUserProfile(session.user.id);
        this.onSessionChange(true);
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
      console.log('SessionManager.signIn called');
      const supabase = await window.getSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not available');
        throw new Error('Supabase not available');
      }

      console.log('Calling Supabase auth.signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      console.log('Supabase auth response:', { hasData: !!data, hasError: !!error });

      if (error) {
        // Log failed login attempt
        await this.logAuthAction(email, 'login_failed', null, error.message);
        
        // Provide user-friendly error message
        let userMessage = error.message;
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid password') ||
            error.message.includes('password') ||
            error.message.includes('credentials')) {
          userMessage = 'Wrong password, try again';
        } else if (error.message.includes('Email not confirmed') || 
                   error.message.includes('email_not_confirmed') ||
                   error.message.includes('Email not verified')) {
          userMessage = 'Email verification required. Please check your email and click the verification link, or disable email confirmation in Supabase settings.';
        } else if (error.message.includes('User not found') || error.message.includes('No user found')) {
          userMessage = 'No account found with this email';
        }
        
        const customError = new Error(userMessage);
        customError.originalError = error;
        throw customError;
      }

      if (data.session) {
        this.currentUser = data.user;
        await this.loadUserProfile(data.user.id);
        
        // Log successful login
        await this.logAuthAction(email, 'login_success', data.user.id);
        
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
      console.log('SessionManager.signUp called');
      const supabase = await window.getSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not available');
        throw new Error('Supabase not available');
      }

      console.log('Calling Supabase auth.signUp...');
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
      
      console.log('Supabase signup response:', { hasData: !!authData, hasError: !!authError });

      if (authError) {
        console.error('Supabase signup error:', authError);
        throw authError;
      }

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

        // If session exists, user is automatically logged in (email confirmation disabled)
        // If session is null, user needs to verify email first (email confirmation enabled)
        if (authData.session) {
          this.currentUser = authData.user;
          await this.loadUserProfile(authData.user.id);
          
          // Log signup
          await this.logAuthAction(email, 'signup', authData.user.id);
          
          return { success: true, user: authData.user };
        } else {
          // Email confirmation required
          return { 
            success: false, 
            error: 'Please check your email and click the verification link to complete signup. If you don\'t see it, check your spam folder.' 
          };
        }
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
        await this.logAuthAction(email, 'logout', userId);
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

  async logAuthAction(email, action, userId = null, error_message = null) {
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) {
        // Silently fail - logging is optional
        return;
      }

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
          error_message: error_message
        });

      if (error) {
        // Only log if it's not a "table doesn't exist" error
        if (!error.message.includes('Could not find the table') && 
            !error.message.includes('does not exist')) {
          console.warn('Error logging auth action (non-critical):', error.message);
        }
        // Silently fail - logging failures shouldn't break auth flow
      }
    } catch (error) {
      // Silently fail - logging is optional and shouldn't break auth flow
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

