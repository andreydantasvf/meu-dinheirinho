import { DemoHttpError } from '../errors';
import type { Route } from '../router';

// Mesmo comportamento do backend sem chaves VAPID: use-push.ts cai em 'server-disabled'.
export const pushRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/push/config',
    handler: () => ({ enabled: false, publicKey: null }),
  },
  {
    method: 'POST',
    pattern: '/push/subscriptions',
    handler: () => {
      throw new DemoHttpError(503, 'Web Push não está configurado no servidor');
    },
  },
  {
    method: 'DELETE',
    pattern: '/push/subscriptions',
    handler: () => undefined,
  },
];
