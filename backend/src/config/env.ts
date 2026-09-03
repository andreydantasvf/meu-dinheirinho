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
});

export const env = envSchema.parse(process.env);
