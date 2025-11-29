// Stripe Terminal Configuration
// IMPORTANT: In production, store these in environment variables, not in code!

const STRIPE_CONFIG = {
  // Get these from: https://dashboard.stripe.com/apikeys
  publishableKey: 'pk_test_YOUR_PUBLISHABLE_KEY_HERE', // Replace with your Stripe publishable key
  // Secret key should NEVER be in frontend code - use backend only!
  
  // Backend API endpoints for Stripe Terminal
  terminalEndpoint: '/api/stripe/terminal/create-payment-intent', // Create payment intent for terminal
  terminalStatusEndpoint: '/api/stripe/terminal/payment-status'   // Check payment status
};

// Make config available globally
window.STRIPE_CONFIG = STRIPE_CONFIG;

