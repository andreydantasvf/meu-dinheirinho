import { env } from '../config/env';
import { webPushNotifier } from '../notifications/web-push.notifier';
import { pushSubscriptionRepository } from '../repositories/push-subscription.repository';
import { AppError } from '../types/errors';
import type { PushSubscriptionInput } from '../validators/push.schema';

export const pushService = {
  config() {
    const enabled = webPushNotifier.isEnabled();
    return { enabled, publicKey: enabled ? env.VAPID_PUBLIC_KEY : null };
  },

  subscribe(data: PushSubscriptionInput) {
    if (!webPushNotifier.isEnabled()) {
      throw new AppError('Web Push não está configurado no servidor', 503);
    }
    return pushSubscriptionRepository.upsert({
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    });
  },

  unsubscribe(endpoint: string) {
    return pushSubscriptionRepository.removeByEndpoint(endpoint);
  },
};
