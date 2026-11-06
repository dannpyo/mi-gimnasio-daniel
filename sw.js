/* Mi Gimnasio Daniel Fernández · 6.1 · Servicio offline */
const CACHE = 'mi-gimnasio-daniel-pwa-shell-2026-11-v61-revision-1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('mi-gimnasio-daniel-pwa-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cachedResponse = async () => {
      const cached = await cache.match(request, {ignoreSearch: true});
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match(new URL('./index.html', self.registration.scope));
    };
    try {
      const response = await fetch(request);
      // Un error HTTP no rechaza fetch: conservar la pantalla disponible al navegar.
      if (!response.ok && request.mode === 'navigate') {
        const cached = await cachedResponse();
        if (cached) return cached;
      }
      const canonical = new URL(request.url);
      canonical.search = '';
      if (response.ok && SHELL_URLS.has(canonical.href)) {
        await cache.put(canonical.href, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await cachedResponse();
      if (cached) return cached;
      throw error;
    }
  })());
});
