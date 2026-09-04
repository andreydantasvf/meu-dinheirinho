import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { authService } from './auth.service';

describe('authService', () => {
  it('login() returns a token when the password matches', () => {
    const result = authService.login(env.AUTH_PASSWORD);

    expect(result.token).toEqual(expect.any(String));
  });

  it('login() throws AppError 401 when the password does not match', () => {
    expect(() => authService.login('wrong-password')).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it('login() throws AppError 401 for an empty password', () => {
    expect(() => authService.login('')).toThrow();
  });
});
