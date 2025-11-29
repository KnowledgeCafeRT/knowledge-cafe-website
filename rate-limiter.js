// rate-limiter.js
// ANTI-SPAM PROTECTION

class SimpleRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  // Prüfe ob Aktion erlaubt ist
  checkLimit(action, maxRequests = 10, timeWindow = 60000) {
    const key = `${action}_${this.getFingerprint()}`;
    const now = Date.now();
    
    const userRequests = this.requests.get(key) || [];
    const recentRequests = userRequests.filter(time => now - time < timeWindow);
    
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = recentRequests[0];
      const waitTime = Math.ceil((oldestRequest + timeWindow - now) / 1000);
      
      this.logRateLimitHit(action);
      throw new Error(`⚠️ Zu viele Anfragen! Bitte ${waitTime} Sekunden warten.`);
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }

  // Eindeutiger Browser-Fingerprint
  getFingerprint() {
    return btoa(navigator.userAgent + navigator.language);
  }

  // Log Rate Limit Hits
  logRateLimitHit(action) {
    const log = {
      timestamp: new Date().toISOString(),
      event: 'rate_limit_exceeded',
      action: action,
      fingerprint: this.getFingerprint()
    };
    
    const logs = JSON.parse(localStorage.getItem('pos_security_logs') || '[]');
    logs.push(log);
    localStorage.setItem('pos_security_logs', JSON.stringify(logs));
    
    console.warn('⚠️ Rate Limit Hit:', log);
  }

  // Reset (für Testing)
  reset() {
    this.requests.clear();
  }
}

// Globale Instanz
window.rateLimiter = new SimpleRateLimiter();
