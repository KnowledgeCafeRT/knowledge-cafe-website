/**
 * Mock API Server for Knowledge Café
 * Run this locally to test the API integration
 * 
 * Usage: node mock-api-server.js
 * Then open http://localhost:3000 in your browser
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for orders (resets when server restarts)
let orders = [];
let orderCounter = 1;

// Store push subscriptions for notifications
const pushSubscriptions = new Map();

// VAPID keys for push notifications (in production, use real keys)
const VAPID_KEYS = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI0Y0yOCc3JWpkLg3l7cb3RIsrTbIFPweyGLtQ7P2ySJcb1tD5S2si3k2U',
  privateKey: 'your-private-key-here'
};

// Mock API Key (for testing)
const MOCK_API_KEY = 'test-api-key-123';

// Authentication middleware
const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== MOCK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Mock API server is running'
  });
});

// Create new order
app.post('/api/orders', authenticateAPI, (req, res) => {
  const orderData = req.body;
  
  console.log('📦 New order received:', {
    id: orderData.id,
    customer: orderData.customer.name,
    items: orderData.items.length,
    total: orderData.totals.total
  });
  
  // Add order to storage
  const order = {
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  orders.push(order);
  
  res.json({ 
    success: true, 
    orderId: orderData.id,
    message: 'Order received successfully'
  });
});

// Update order status
app.patch('/api/orders/:orderId', authenticateAPI, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  
  const orderIndex = orders.findIndex(order => order.id == orderId);
  
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  orders[orderIndex].status = status;
  orders[orderIndex].updatedAt = new Date().toISOString();
  
  console.log(`🔄 Order #${orderId} status updated to: ${status}`);
  
  res.json({ 
    success: true, 
    message: `Order #${orderId} status updated to ${status}`
  });
});

// Get all orders
app.get('/api/orders', authenticateAPI, (req, res) => {
  const { status } = req.query;
  
  let filteredOrders = orders;
  if (status) {
    filteredOrders = orders.filter(order => order.status === status);
  }
  
  // Sort by creation time (newest first)
  filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(filteredOrders);
});

// Get single order
app.get('/api/orders/:orderId', authenticateAPI, (req, res) => {
  const { orderId } = req.params;
  const order = orders.find(order => order.id == orderId);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(order);
});

// Delete order (for testing)
app.delete('/api/orders/:orderId', authenticateAPI, (req, res) => {
  const { orderId } = req.params;
  const orderIndex = orders.findIndex(order => order.id == orderId);
  
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  orders.splice(orderIndex, 1);
  console.log(`🗑️ Order #${orderId} deleted`);
  
  res.json({ 
    success: true, 
    message: `Order #${orderId} deleted`
  });
});

// Get API status and stats
app.get('/api/stats', authenticateAPI, (req, res) => {
  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    preparingOrders: orders.filter(o => o.status === 'preparing').length,
    readyOrders: orders.filter(o => o.status === 'ready').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    lastOrderTime: orders.length > 0 ? orders[0].createdAt : null
  };
  
  res.json(stats);
});

// Clear all orders (for testing)
app.delete('/api/orders', authenticateAPI, (req, res) => {
  orders = [];
  console.log('🧹 All orders cleared');
  res.json({ 
    success: true, 
    message: 'All orders cleared'
  });
});

// Serve static files (your website)
app.use(express.static('.'));

// Push notification endpoints
app.post('/api/notifications/subscribe', (req, res) => {
  const { subscription, customerId } = req.body;
  
  if (!subscription || !customerId) {
    return res.status(400).json({ error: 'Missing subscription or customerId' });
  }
  
  pushSubscriptions.set(customerId, subscription);
  console.log(`🔔 Push subscription registered for customer: ${customerId}`);
  
  res.json({
    success: true,
    message: 'Push subscription registered successfully'
  });
});

app.post('/api/notifications/unsubscribe', (req, res) => {
  const { customerId } = req.body;
  
  if (pushSubscriptions.has(customerId)) {
    pushSubscriptions.delete(customerId);
    console.log(`🔕 Push subscription removed for customer: ${customerId}`);
  }
  
  res.json({
    success: true,
    message: 'Push subscription removed successfully'
  });
});

app.get('/api/notifications/vapid-key', (req, res) => {
  res.json({
    success: true,
    publicKey: VAPID_KEYS.publicKey
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Mock API Server is running!
📡 API Endpoint: http://localhost:${PORT}/api
🌐 Website: http://localhost:${PORT}
🔑 API Key: ${MOCK_API_KEY}

📋 Available endpoints:
  GET  /api/health          - Health check
  POST /api/orders          - Create order
  GET  /api/orders          - Get all orders
  GET  /api/orders/:id      - Get single order
  PATCH /api/orders/:id     - Update order status
  DELETE /api/orders/:id    - Delete order
  GET  /api/stats           - Get statistics
  DELETE /api/orders        - Clear all orders
  POST /api/notifications/subscribe   - Subscribe to push notifications
  POST /api/notifications/unsubscribe - Unsubscribe from push notifications
  GET  /api/notifications/vapid-key   - Get VAPID public key

💡 To test the integration:
1. Open http://localhost:${PORT} in your browser
2. Place an order on the website
3. Check the console for order logs
4. Visit http://localhost:${PORT}/internal-system-example.html to see orders
  `);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down mock API server...');
  process.exit(0);
});
