// This is a simple service worker for development
// It will be replaced by the Workbox-generated one in production

self.addEventListener('install', () => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('Service Worker activated.');
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // For now, just log fetch events
  // console.log commented out to avoid console warnings in production
  // console.log('Fetch intercepted for:', event.request.url);
  event.respondWith(fetch(event.request));
});