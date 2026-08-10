import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema } from '../validators/auth.schema';

export const authController = {
  async login(req: Request, res: Response) {
    const { password } = loginSchema.parse(req.body);
    const result = authService.login(password);
    res.json(result);
  },
};
