import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { PushConfig } from '@/types/entities';

export type PushStatus =
  | 'loading'
  /** Browser lacks Push API — on iOS this means "not installed to Home Screen" or iOS < 16.4. */
  | 'unsupported'
  /** No service worker registered — e.g. `pnpm dev`, where the PWA plugin doesn't register one. */
  | 'no-service-worker'
  /** Backend has no VAPID keys configured. */
  | 'server-disabled'
  | 'denied'
  | 'unsubscribed'
  | 'subscribed';

const SW_LOOKUP_TIMEOUT_MS = 3000;

function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// `navigator.serviceWorker.ready` never resolves when no SW is registered, so race it.
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SW_LOOKUP_TIMEOUT_MS),
    ),
  ]);
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function usePush() {
  const supported = isPushSupported();
  const config = useQuery({
    queryKey: queryKeys.pushConfig,
    queryFn: () => apiFetch<PushConfig>('/push/config'),
    enabled: supported,
  });

  const [registration, setRegistration] = useState<
    ServiceWorkerRegistration | null | undefined
  >(undefined);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'default',
  );
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    getRegistration().then(async (reg) => {
      if (cancelled) return;
      setRegistration(reg);
      if (reg) setSubscription(await reg.pushManager.getSubscription());
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  let status: PushStatus;
  if (!supported) status = 'unsupported';
  else if (registration === undefined || config.isLoading) status = 'loading';
  else if (!registration) status = 'no-service-worker';
  else if (!config.data?.enabled) status = 'server-disabled';
  else if (permission === 'denied') status = 'denied';
  else if (subscription) status = 'subscribed';
  else status = 'unsubscribed';

  // Must run from a user gesture (tap) — iOS rejects permission prompts otherwise.
  const subscribe = useCallback(async () => {
    if (!registration || !config.data?.publicKey) return;
    setIsWorking(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.data.publicKey),
      });
      await apiFetch('/push/subscriptions', {
        method: 'POST',
        body: sub.toJSON(),
      });
      setSubscription(sub);
    } finally {
      setIsWorking(false);
    }
  }, [registration, config.data]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setIsWorking(true);
    try {
      await apiFetch('/push/subscriptions', {
        method: 'DELETE',
        body: { endpoint: subscription.endpoint },
      });
      await subscription.unsubscribe();
      setSubscription(null);
    } finally {
      setIsWorking(false);
    }
  }, [subscription]);

  return { status, isWorking, subscribe, unsubscribe };
}
