/// <reference lib="webworker" />
// Service worker customizado (vite-plugin-pwa `injectManifest`). Replica o que o
// `generateSW` gerava antes — precache, limpeza de caches antigos, fallback SPA e
// auto-update — e adiciona os handlers de Web Push dos lembretes. Continua sem
// `runtimeCaching` para a API, de propósito (ver docs/web-architecture.md).
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

type PushPayload = { title: string; body: string; url?: string };

self.addEventListener('push', (event) => {
  const payload: PushPayload = event.data?.json() ?? {
    title: 'Meu Dinheirinho',
    body: '',
  };
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? '/',
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
