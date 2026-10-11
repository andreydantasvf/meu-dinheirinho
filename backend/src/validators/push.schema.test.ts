import { describe, expect, it } from 'vitest';
import { pushSubscriptionSchema } from './push.schema';

const keys = { p256dh: 'p', auth: 'a' };

describe('pushSubscriptionSchema', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QGx...',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-by3p.notify.windows.com/w/?token=abc',
  ])('accepts a browser push service endpoint: %s', (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      true,
    );
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // não-HTTPS
    'https://localhost:3000/health',
    'https://169.254.169.254/latest/meta-data',
    'https://evil.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x', // sufixo enganoso
    'https://evilpush.services.mozilla.com.attacker.io/x',
  ])('rejects a non-push-service endpoint: %s', (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      false,
    );
  });
});
