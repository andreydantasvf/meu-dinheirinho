import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/token';
import { AppError } from '../types/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.header('x-api-token');
  if (!token || !verifyToken(token)) {
    throw new AppError('Não autorizado', 401);
  }
  next();
}
