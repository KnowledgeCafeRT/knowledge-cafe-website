// Supabase Configuration for Frontend
// Replace these with your actual Supabase project credentials

const SUPABASE_CONFIG = {
  url: 'https://gevuuhrebkjcvvyakwrl.supabase.co', // Your Supabase project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldnV1aHJlYmtqY3Z2eWFrd3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTc0MzAsImV4cCI6MjA3NjIzMzQzMH0.GkPrWH_w9mszEEQJaKE4FYxYej-_ZUnVVOr4r9ktofQ' // Your Supabase anon key
};

// Initialize Supabase client with session persistence
let supabase = null;

// Load Supabase client library and initialize
async function initSupabase() {
  if (window.supabase) {
    // Supabase already loaded - create client with session persistence
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true, // Keep user logged in across sessions
        autoRefreshToken: true, // Automatically refresh tokens
        detectSessionInUrl: true // Detect auth callbacks in URL
      }
    });
    return supabase;
  }
  
  // Load Supabase JS library
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = () => {
      // Create client with session persistence
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          persistSession: true, // Keep user logged in across sessions
          autoRefreshToken: true, // Automatically refresh tokens
          detectSessionInUrl: true // Detect auth callbacks in URL
        }
      });
      resolve(supabase);
    };
    script.onerror = () => {
      console.error('Failed to load Supabase library');
      reject(new Error('Failed to load Supabase'));
    };
    document.head.appendChild(script);
  });
}

// Get Supabase client (initialize if needed)
async function getSupabaseClient() {
  if (supabase) return supabase;
  return await initSupabase();
}

// Export for use in other files - set immediately
window.getSupabaseClient = getSupabaseClient;

// Also try to initialize immediately if Supabase library is already loaded
if (typeof window.supabase !== 'undefined') {
  initSupabase().catch(err => console.error('Error initializing Supabase:', err));
}

