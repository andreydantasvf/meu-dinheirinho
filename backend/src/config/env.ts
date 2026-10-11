import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  AUTH_PASSWORD: z.string().min(1, 'AUTH_PASSWORD is required'),
  AUTH_TOKEN_SECRET: z.string().min(1, 'AUTH_TOKEN_SECRET is required'),
  AUTH_USER_NAME: z.string().default(''),
  WEBAUTHN_RP_ID: z.string().min(1, 'WEBAUTHN_RP_ID is required'),
  WEBAUTHN_RP_NAME: z.string().min(1, 'WEBAUTHN_RP_NAME is required'),
  WEBAUTHN_ORIGIN: z.string().min(1, 'WEBAUTHN_ORIGIN is required'),
  // Lembretes: fuso usado para interpretar dia/horário configurados pelo usuário.
  REMINDERS_TZ: z.string().default('America/Sao_Paulo'),
  // Canais de notificação — todos opcionais; canal sem config vira no-op.
  DISCORD_WEBHOOK_URL: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // URL pública do app web, usada nos links das notificações.
  WEB_APP_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
