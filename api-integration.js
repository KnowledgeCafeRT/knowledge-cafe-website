/**
 * API Integration for Knowledge Café
 * This file handles sending orders to your internal system
 */

class CafeAPI {
  constructor() {
    // Configure your API endpoint here
    this.apiEndpoint = 'https://your-internal-system.com/api/orders';
    this.apiKey = 'your-api-key-here'; // Store securely
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Send order to internal system
   * @param {Object} order - The order object
   * @returns {Promise<boolean>} - Success status
   */
  async sendOrder(order) {
    const orderData = {
      id: order.id,
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        userType: order.userType || 'guest'
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        pfand: item.pfand || false
      })),
      totals: {
        subtotal: order.subtotal,
        taxes: order.taxes,
        pfand: order.pfand || 0,
        total: order.total
      },
      status: 'pending',
      createdAt: order.date,
      source: 'website'
    };

    return await this.makeRequest('POST', '/orders', orderData);
  }

  /**
   * Update order status in internal system
   * @param {string} orderId - Order ID
   * @param {string} status - New status (pending, preparing, ready, completed)
   * @returns {Promise<boolean>} - Success status
   */
  async updateOrderStatus(orderId, status) {
    return await this.makeRequest('PATCH', `/orders/${orderId}`, { status });
  }

  /**
   * Get orders from internal system
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} - Array of orders
   */
  async getOrders(status = null) {
    const url = status ? `/orders?status=${status}` : '/orders';
    return await this.makeRequest('GET', url);
  }

  /**
   * Make HTTP request with retry logic
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} - Response data
   */
  async makeRequest(method, endpoint, data = null) {
    const url = `${this.apiEndpoint}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Source': 'knowledge-cafe-website'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`API ${method} ${endpoint}: Success`, result);
        return result;

      } catch (error) {
        console.error(`API ${method} ${endpoint} attempt ${attempt}:`, error);
        
        if (attempt === this.retryAttempts) {
          // Store failed request for later retry
          this.storeFailedRequest(method, endpoint, data);
          return false;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  /**
   * Store failed requests for offline retry
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   */
  storeFailedRequest(method, endpoint, data) {
    const failedRequests = JSON.parse(localStorage.getItem('kcafe_failed_requests') || '[]');
    failedRequests.push({
      method,
      endpoint,
      data,
      timestamp: new Date().toISOString(),
      retries: 0
    });
    localStorage.setItem('kcafe_failed_requests', JSON.stringify(failedRequests));
  }

  /**
   * Retry failed requests when connection is restored
   */
  async retryFailedRequests() {
    const failedRequests = JSON.parse(localStorage.getItem('kcafe_failed_requests') || '[]');
    const successful = [];

    for (let i = 0; i < failedRequests.length; i++) {
      const request = failedRequests[i];
      const success = await this.makeRequest(request.method, request.endpoint, request.data);
      
      if (success) {
        successful.push(i);
      }
    }

    // Remove successful requests
    const remaining = failedRequests.filter((_, index) => !successful.includes(index));
    localStorage.setItem('kcafe_failed_requests', JSON.stringify(remaining));
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

// Initialize API
const cafeAPI = new CafeAPI();

// Export for use in other files
window.CafeAPI = cafeAPI;
