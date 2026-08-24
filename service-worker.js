const CACHE_VERSION = 'indy-schedule-v1.3.2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './design-tokens.css',
    './styles.css',
    './styles2.css',
    './dialog-manager.js',
    './auth.js',
    './firebase-loader.js',
    './gradient.js',
    './script2.js',
    './school-calendar.js',
    './lunch-menu.js',
    './script.js',
    './data/ihs-calendar-events.json',
    './indy_schedule_logo_sizes/indy-schedule-logo-192x192.png',
    './indy_schedule_logo_sizes/indy-schedule-logo-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => Promise.allSettled(APP_SHELL.map((path) => cache.add(path))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((key) => key.startsWith('indy-schedule-') && key !== CACHE_VERSION)
                .map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

const cacheSuccessfulResponse = async (request, response) => {
    if (response?.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
    }
    return response;
};

const networkFirst = async (request, fallbackPath) => {
    try {
        return await cacheSuccessfulResponse(request, await fetch(request));
    } catch (error) {
        return (await caches.match(request))
            || (fallbackPath ? await caches.match(fallbackPath) : null)
            || Response.error();
    }
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, './index.html'));
        return;
    }

    if (url.pathname.includes('/data/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const refreshed = fetch(request)
                .then((response) => cacheSuccessfulResponse(request, response))
                .catch(() => Response.error());
            return cached || refreshed;
        })
    );
});
