// Keeps the Family Screen app itself working with no internet. Family data is cached by Firebase separately.
const VERSION = 'fs-mwererni';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'earth-day.jpg', 'earth-night.jpg'].concat(["lib/globe-8f2384e0ca.js","lib/cards-23fbe90e1e.js"]);
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (/manifest\.webmanifest$/.test(url.pathname)) { e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match(req))); return; }   // always the newest app details (shortcuts)
  if (/version\.json$/.test(url.pathname)) { e.respondWith(fetch(req).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))); return; }   // never cached
  if (url.search.includes('fresh=1') && /\/(index\.html)?$/.test(url.pathname)) {   // the app asking for the newest copy before it reloads: fetch, store, then answer
    e.respondWith(fetch(new Request(url.pathname, { cache: 'no-cache' })).then(r => { if (!r.ok) return r; const cp = r.clone(); return caches.open(VERSION).then(c => c.put('index.html', cp)).then(() => r); }).catch(() => caches.match('index.html')));
    return;
  }
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) {
    // open straight from the cache (instant, and fine with no internet); fetch the newest copy in the background,
    // and the app's own version check reloads when a newer one has arrived
    e.respondWith(caches.match('index.html').then(cached => {
      const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put('index.html', cp)); } return r; });
      if (cached) { net.catch(() => null); return cached; }
      return net.catch(() => caches.match('./'));
    }));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { if (n.ok) { const cp = n.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return n; })));
});

// Phone notifications from the family's helper (Firebase Cloud Messaging, data messages)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { title: 'Family Screen', body: e.data ? e.data.text() : '' } }; }
  const m = Object.assign({}, d.notification || {}, d.data || {});
  e.waitUntil(self.registration.showNotification(m.title || 'Family Screen', { body: m.body || '', tag: m.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: m.url || './' }, renotify: !!m.tag }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow(url); }));
});
