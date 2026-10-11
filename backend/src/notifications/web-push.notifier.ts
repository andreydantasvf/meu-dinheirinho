import webpush, { WebPushError } from 'web-push';
import { env } from '../config/env';
import { pushSubscriptionRepository } from '../repositories/push-subscription.repository';
import type { NotificationMessage } from './reminder-message';

let configured = false;

function ensureConfigured(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }
  if (!configured) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );
    configured = true;
  }
  return true;
}

export const webPushNotifier = {
  name: 'web-push',

  isEnabled() {
    return ensureConfigured();
  },

  async send(message: NotificationMessage) {
    if (!ensureConfigured()) return;
    const subscriptions = await pushSubscriptionRepository.findAll();
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.path,
    });

    const results = await Promise.allSettled(
      subscriptions.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ),
      ),
    );

    let failures = 0;
    await Promise.all(
      results.map(async (result, i) => {
        if (result.status === 'fulfilled') return;
        const error = result.reason;
        // 404/410: o navegador revogou a subscription — remove para não tentar de novo.
        if (
          error instanceof WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await pushSubscriptionRepository.removeByEndpoint(
            subscriptions[i].endpoint,
          );
          return;
        }
        failures++;
        console.error('[WebPush] Falha ao enviar:', error);
      }),
    );

    if (failures > 0 && failures === subscriptions.length) {
      throw new Error('Web Push falhou para todas as subscriptions');
    }
  },
};
