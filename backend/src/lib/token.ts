import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac('sha256', env.AUTH_TOKEN_SECRET).update(payload).digest('base64url');
}

export function issueToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function currentUserName(): string {
  return env.AUTH_USER_NAME;
}

export function verifyToken(token: string): boolean {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}
