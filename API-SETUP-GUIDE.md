# Knowledge Café API Integration Setup Guide

## Overview
This guide explains how to connect the customer-facing website to your internal order management system using APIs.

## Architecture

```
Customer Website → API Integration → Your Internal System
     ↓                    ↓                    ↓
  Places Order    →   Sends via API    →   Receives Order
  (checkout.js)      (api-integration.js)   (Your Backend)
```

## Files Created

### 1. `api-integration.js`
- Handles all API communication
- Includes retry logic and offline fallback
- Sends orders to your internal system
- Updates order statuses

### 2. `internal-system-example.html`
- Example of how your internal system should work
- Shows how to receive and manage orders
- Includes order status management

### 3. `display.html` (removed from public navigation)
- Internal display screen for cafe staff
- Only accessible via direct URL
- Shows real-time order status

## Setup Steps

### Step 1: Configure Your API Endpoint

Edit `api-integration.js` and update these values:

```javascript
class CafeAPI {
  constructor() {
    this.apiEndpoint = 'https://your-internal-system.com/api/orders';
    this.apiKey = 'your-secure-api-key-here';
    // ... rest of config
  }
}
```

### Step 2: Create Your Backend API

Your internal system needs these endpoints:

#### POST `/api/orders`
Receives new orders from the website.

**Request Body:**
```json
{
  "id": "1234567890",
  "customer": {
    "name": "John Doe",
    "email": "john@university.edu",
    "phone": "+1234567890",
    "userType": "student"
  },
  "items": [
    {
      "name": "Cappuccino",
      "quantity": 2,
      "price": 3.50,
      "pfand": true
    }
  ],
  "totals": {
    "subtotal": 7.00,
    "taxes": 0.35,
    "pfand": 4.00,
    "total": 11.35
  },
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00Z",
  "source": "website"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "1234567890",
  "message": "Order received"
}
```

#### PATCH `/api/orders/{orderId}`
Updates order status.

**Request Body:**
```json
{
  "status": "preparing"
}
```

#### GET `/api/orders`
Retrieves all orders (for internal display).

**Query Parameters:**
- `status` (optional): Filter by status (pending, preparing, ready, completed)

#### GET `/api/health`
Health check endpoint.

### Step 3: Security Considerations

1. **API Key Authentication:**
   ```javascript
   headers: {
     'Authorization': `Bearer ${this.apiKey}`,
     'Content-Type': 'application/json'
   }
   ```

2. **HTTPS Only:**
   - Always use HTTPS for API communication
   - Never send API keys over HTTP

3. **Rate Limiting:**
   - Implement rate limiting on your API
   - Handle burst traffic during peak hours

4. **Input Validation:**
   - Validate all incoming order data
   - Sanitize customer information
   - Check for duplicate orders

### Step 4: Error Handling

The API integration includes:

- **Retry Logic:** 3 attempts with exponential backoff
- **Offline Fallback:** Stores orders locally if API is down
- **Automatic Sync:** Retries failed requests when connection is restored

### Step 5: Testing

1. **Test API Connection:**
   ```javascript
   // In browser console
   window.CafeAPI.testConnection();
   ```

2. **Test Order Submission:**
   - Place a test order on the website
   - Check your internal system receives it
   - Verify order status updates work

## Example Backend Implementation

### Node.js/Express Example

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Middleware for API key authentication
const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.CAFE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create order
app.post('/api/orders', authenticateAPI, (req, res) => {
  const order = req.body;
  
  // Validate order data
  if (!order.id || !order.customer || !order.items) {
    return res.status(400).json({ error: 'Invalid order data' });
  }
  
  // Save to database
  saveOrderToDatabase(order);
  
  // Notify internal systems
  notifyInternalSystems(order);
  
  res.json({ 
    success: true, 
    orderId: order.id,
    message: 'Order received' 
  });
});

// Update order status
app.patch('/api/orders/:orderId', authenticateAPI, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  
  updateOrderStatus(orderId, status);
  res.json({ success: true });
});

// Get orders
app.get('/api/orders', authenticateAPI, (req, res) => {
  const { status } = req.query;
  const orders = getOrdersFromDatabase(status);
  res.json(orders);
});

app.listen(3000, () => {
  console.log('Cafe API server running on port 3000');
});
```

### Python/Flask Example

```python
from flask import Flask, request, jsonify
from functools import wraps
import os

app = Flask(__name__)

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
        if api_key != os.environ.get('CAFE_API_KEY'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/orders', methods=['POST'])
@require_api_key
def create_order():
    order_data = request.get_json()
    
    # Validate and save order
    # ... your logic here
    
    return jsonify({
        'success': True,
        'orderId': order_data['id'],
        'message': 'Order received'
    })

@app.route('/api/orders/<order_id>', methods=['PATCH'])
@require_api_key
def update_order_status(order_id):
    status = request.get_json().get('status')
    
    # Update order status
    # ... your logic here
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
```

## Deployment Considerations

### 1. Environment Variables
Store sensitive data in environment variables:
```bash
CAFE_API_KEY=your-secure-api-key-here
DATABASE_URL=your-database-connection-string
```

### 2. CORS Configuration
Configure CORS to allow requests from your website domain:
```javascript
app.use(cors({
  origin: ['https://your-cafe-website.com'],
  credentials: true
}));
```

### 3. Database
Choose a database that fits your needs:
- **SQLite:** Simple, file-based (good for small cafes)
- **PostgreSQL:** Robust, scalable (good for multiple locations)
- **MongoDB:** Document-based, flexible schema

### 4. Monitoring
Set up monitoring for:
- API response times
- Error rates
- Order volume
- Failed requests

## Troubleshooting

### Common Issues

1. **Orders not appearing in internal system:**
   - Check API endpoint URL
   - Verify API key is correct
   - Check browser console for errors
   - Test API connection

2. **CORS errors:**
   - Configure CORS on your backend
   - Check domain whitelist

3. **Authentication failures:**
   - Verify API key format
   - Check Authorization header

4. **Network timeouts:**
   - Increase timeout values
   - Check network connectivity
   - Verify API server is running

### Debug Mode
Enable debug logging in `api-integration.js`:
```javascript
// Add this to see detailed logs
console.log('API Request:', method, endpoint, data);
console.log('API Response:', response);
```

## Security Best Practices

1. **Use HTTPS everywhere**
2. **Rotate API keys regularly**
3. **Implement rate limiting**
4. **Log all API requests**
5. **Validate all input data**
6. **Use environment variables for secrets**
7. **Implement proper error handling**
8. **Regular security audits**

## Support

If you need help implementing this system:
1. Check the browser console for errors
2. Test API endpoints with tools like Postman
3. Verify network connectivity
4. Check server logs for issues

The system is designed to be robust with offline fallback, so even if the API is temporarily down, orders will be stored locally and synced when the connection is restored.
