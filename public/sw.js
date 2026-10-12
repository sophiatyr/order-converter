// Retire legacy caches so the browser loads the newly built local interface.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('garment-po-system-')) await caches.delete(name);
  await self.registration.unregister();
  await self.clients.claim();
})()));
