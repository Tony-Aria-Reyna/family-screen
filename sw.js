// Keeps the Family Screen app itself working with no internet. Family data is cached by Firebase separately.
const VERSION = 'fs-mwq0w2ft';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'earth-day.jpg', 'earth-night.jpg'].concat(["lib/globe-8f2384e0ca.js","lib/cards-23fbe90e1e.js"]);
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION && !/^fs-(photos|keep)/.test(x)).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  // 2.4 Android's Share menu → Family Screen: keep what was shared (text, link, up to 3 files) and open the app to sort it
  if (req.method === 'POST' && /\/share\/?$/.test(new URL(req.url).pathname)) {
    e.respondWith((async () => {
      try {
        const f = await req.formData(), c = await caches.open('fs-share');
        const meta = { title: String(f.get('title') || ''), text: String(f.get('text') || ''), url: String(f.get('url') || ''), at: Date.now(), files: [] };
        const files = f.getAll('file').filter(x => x && typeof x === 'object' && x.size);
        for (let i = 0; i < Math.min(files.length, 20); i++) {
          const x = files[i], k = 'share-file-' + i;
          await c.put(k, new Response(x, { headers: { 'Content-Type': x.type || 'application/octet-stream' } }));
          meta.files.push({ k, type: x.type || '', name: x.name || 'shared', size: x.size });
        }
        await c.put('share-meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
      } catch (x) {}
      return Response.redirect(new URL('./?open=share', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
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
  const tag = m.tag || '', isCall = /^call-/.test(tag);
  // a message for a chat replaces that chat's "is calling" alert (the call was missed or is over)
  const tidy = /^msg-/.test(tag) ? self.registration.getNotifications({ tag: 'call-' + tag.slice(4) }).then(ns => ns.forEach(n => n.close())).catch(() => null) : Promise.resolve();
  e.waitUntil(tidy.then(() => self.registration.showNotification(m.title || 'Family Screen', Object.assign({ body: m.body || '', tag: tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png',
    data: { url: m.url || './', open: /^msg-/.test(tag) ? 'msg:' + tag.slice(4) : isCall ? 'call:' + tag.slice(5) : tag === 'inbox' ? 'inbox' : '' }, renotify: !!tag },
    isCall ? { requireInteraction: true, vibrate: [400, 200, 400, 200, 400, 200, 600] } : {}))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {}, open = d.open || '';
  // a message or inbox notification opens that thing: tell the app if it is already running, otherwise start it there
  const url = open ? './?open=' + encodeURIComponent(open) : (d.url || './');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { if (open) c.postMessage({ open }); return c.focus(); } }
    return self.clients.openWindow(url); }));
});
