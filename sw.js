/* Sonora service worker — app shell always loads, even if the server naps.
   Render free instances cold-start; without this the browser shows a blank
   page or a connection error. With it the UI paints instantly from cache and
   fills in data as soon as the backend answers. */
const V = 'sonora-v31';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/logo.svg', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).catch(() => { })));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // never cache audio — always hit the network so range requests work
  if (url.pathname === '/stream' || url.pathname === '/dl') return;

  // API: network first, fall back to the last good response
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/live' || url.pathname.startsWith('/api/room')) return;
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net.ok) { const c = await caches.open(V); c.put(req, net.clone()); }
        return net;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        return new Response(JSON.stringify({ error: 'offline', offline: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // shell: NETWORK FIRST so updates land immediately; cache is only a fallback
  e.respondWith((async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4500);
      const net = await fetch(req, { signal: ctl.signal, cache: 'no-cache' });
      clearTimeout(t);
      if (net && net.ok) { const c = await caches.open(V); c.put(req, net.clone()); return net; }
      throw new Error('bad');
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      const shell = await caches.match('/index.html');
      if (shell) return shell;
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
