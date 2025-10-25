// Service Worker for Knowledge Cafe Push Notifications
const CACHE_NAME = 'knowledge-cafe-v1';
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0Y0yOCc3JWpkLg3l7cb3RIsrTbIFPweyGLtQ7P2ySJcb1tD5S2si3k2U';

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll([
          '/',
          '/index.html',
          '/order.html',
          '/checkout.html',
          '/profile.html',
          '/login.html',
          '/style.css',
          '/script.js',
          '/order.js',
          '/checkout.js',
          '/profile.js',
          '/auth.js'
        ]);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activated!');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);
  
  let notificationData = {
    title: 'Knowledge Cafe',
    body: 'You have a new notification',
    icon: '/assets/icon-192x192.png',
    badge: '/assets/badge-72x72.png',
    tag: 'knowledge-cafe-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Order',
        icon: '/assets/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/assets/dismiss-icon.png'
      }
    ]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Default action or 'view' action
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes('knowledge-cafe') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync for offline orders
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'order-sync') {
    event.waitUntil(syncOfflineOrders());
  }
});

// Sync offline orders when connection is restored
async function syncOfflineOrders() {
  try {
    const offlineOrders = await getOfflineOrders();
    console.log('📦 Syncing offline orders:', offlineOrders.length);
    
    for (const order of offlineOrders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order)
        });
        
        if (response.ok) {
          console.log('✅ Order synced:', order.id);
          await removeOfflineOrder(order.id);
        }
      } catch (error) {
        console.log('❌ Failed to sync order:', order.id, error);
      }
    }
  } catch (error) {
    console.log('❌ Background sync failed:', error);
  }
}

// Helper functions for offline storage
async function getOfflineOrders() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match('/offline-orders');
  if (response) {
    return await response.json();
  }
  return [];
}

async function removeOfflineOrder(orderId) {
  const cache = await caches.open(CACHE_NAME);
  const offlineOrders = await getOfflineOrders();
  const updatedOrders = offlineOrders.filter(order => order.id !== orderId);
  await cache.put('/offline-orders', new Response(JSON.stringify(updatedOrders)));
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('💬 Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('☕ Knowledge Cafe Service Worker loaded!');
