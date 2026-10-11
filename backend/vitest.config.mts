import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: 'file:./prisma/dev.db',
      AUTH_PASSWORD: 'test-password',
      AUTH_TOKEN_SECRET: 'test-token-secret-min-32-chars-long-for-hmac',
      WEBAUTHN_RP_ID: 'localhost',
      WEBAUTHN_RP_NAME: 'Meu Dinheirinho Test',
      WEBAUTHN_ORIGIN: 'http://localhost:5173',
      REMINDERS_TZ: 'America/Sao_Paulo',
    },
  },
});
