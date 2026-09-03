import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: 'Dados inválidos', issues: err.issues });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
