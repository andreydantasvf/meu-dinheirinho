import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { currentUserName, issueToken } from '../lib/token';
import { AppError } from '../types/errors';

export const authService = {
  login(password: string) {
    const expected = Buffer.from(env.AUTH_PASSWORD);
    const actual = Buffer.from(password);
    const valid =
      expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) throw new AppError('Senha inválida', 401);

    return { token: issueToken(), name: currentUserName() };
  },
};
