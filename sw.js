// Service worker del Tracker: hace que la app abra sin conexión.
// En cada publicación sube CACHE_VERSION (v2, v3…) para que el iPhone ofrezca «Actualizar».
// IMPORTANTE: este archivo nunca toca IndexedDB; solo administra la caché de archivos de la app.
const CACHE_VERSION = 'v1';
const PREFIX = 'tracker-';
const CACHE_NAME = PREFIX + CACHE_VERSION;
const LEGACY_PREFIXES = ['iphone-pwa-']; // cachés de la plantilla original

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/calc.js',
  './js/data.js',
  './js/seed.js',
  './js/backup.js',
  './js/ui/dom.js',
  './js/ui/perfil.js',
  './js/ui/hoy.js',
  './js/ui/registrar.js',
  './js/ui/peso.js',
  './js/ui/progreso.js',
  './js/ui/ajustes.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' evita tomar archivos viejos de la caché HTTP del navegador
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

// Solo borra cachés propias de versiones anteriores (y las de la plantilla original)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== CACHE_NAME && (k.startsWith(PREFIX) || LEGACY_PREFIXES.some((p) => k.startsWith(p))))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION') event.source?.postMessage({ version: CACHE_VERSION });
});

// Cache-first para el app shell: la app abre igual con o sin conexión.
// Lo que no está en caché va a la red y se guarda para la próxima vez.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // La app (raíz o index.html) abre desde caché; otras páginas (p. ej. tests/) van a la red
    const raiz = new URL('./', self.registration.scope).pathname;
    if (url.pathname === raiz || url.pathname === raiz + 'index.html') {
      event.respondWith(caches.match('./index.html').then((r) => r || fetch(request)));
    } else {
      event.respondWith(fetch(request).catch(() => caches.match(request)));
    }
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && url.pathname.match(/\.(js|css|png|webmanifest|html)$/)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
      }
      return response;
    }))
  );
});
