import { prisma } from '../lib/prisma';

type SubscriptionData = { endpoint: string; p256dh: string; auth: string };

export const pushSubscriptionRepository = {
  findAll() {
    return prisma.pushSubscription.findMany();
  },

  upsert(data: SubscriptionData) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: data,
      update: { p256dh: data.p256dh, auth: data.auth },
    });
  },

  removeByEndpoint(endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },
};
