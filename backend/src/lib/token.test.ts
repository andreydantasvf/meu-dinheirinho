import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueToken, verifyToken } from './token';

describe('token', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('issueToken() produces a token that verifyToken() accepts', () => {
    const token = issueToken();

    expect(verifyToken(token)).toBe(true);
  });

  it('verifyToken() rejects a token with a tampered signature', () => {
    const token = issueToken();
    const [payload, signature] = token.split('.');
    const flippedSignature = signature.slice(0, -1) + (signature.at(-1) === 'a' ? 'b' : 'a');

    expect(verifyToken(`${payload}.${flippedSignature}`)).toBe(false);
  });

  it('verifyToken() rejects a tampered payload', () => {
    const token = issueToken();
    const [, signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 999999 })).toString('base64url');

    expect(verifyToken(`${tamperedPayload}.${signature}`)).toBe(false);
  });

  it('verifyToken() rejects malformed tokens', () => {
    expect(verifyToken('not-a-token')).toBe(false);
    expect(verifyToken('')).toBe(false);
  });

  it('verifyToken() rejects an expired token', () => {
    vi.useFakeTimers();
    const token = issueToken();

    vi.advanceTimersByTime(91 * 24 * 60 * 60 * 1000);

    expect(verifyToken(token)).toBe(false);
  });
});
