/* Coin Kingdom service worker — force auto-update (skipWaiting + claim) so installed PWAs always run the latest. */
const CACHE='ck-v5';
const NET_TIMEOUT=2200;  // ms a page-fetch may race before serving cache (offline = instant)
const SHELL=['./','./index.html','./manifest.json','./icon.svg'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{})); });
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate' || e.request.destination === 'document' || /\.html($|\?)/.test(e.request.url);
  if (isPage) {
    // network-first WITH a fast cache fallback — offline/dead net never hangs (serves cache ~0ms); online still fresh (updates show)
    e.respondWith((async () => {
      const cached = await caches.match(e.request) || await caches.match('./index.html');
      if (cached && self.navigator && self.navigator.onLine === false) return cached;
      const network = fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); return res; }).catch(() => null);
      if (cached) { const timer = new Promise(r => setTimeout(() => r(null), NET_TIMEOUT)); return (await Promise.race([network, timer])) || cached; }
      return (await network) || caches.match('./index.html');
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); return res; }).catch(() => caches.match('./index.html'))));
});
