import { prisma } from '../lib/prisma';

export const webauthnRepository = {
  findFirst() {
    return prisma.webauthnCredential.findFirst();
  },

  findByCredentialId(credentialId: string) {
    return prisma.webauthnCredential.findUnique({ where: { credentialId } });
  },

  create(data: {
    credentialId: string;
    publicKey: Uint8Array<ArrayBuffer>;
    counter: bigint;
  }) {
    return prisma.webauthnCredential.create({ data });
  },

  updateCounter(credentialId: string, counter: bigint) {
    return prisma.webauthnCredential.update({
      where: { credentialId },
      data: { counter },
    });
  },
};
