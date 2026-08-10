import type { Request, Response } from 'express';
import { webauthnService } from '../services/webauthn.service';

export const webauthnController = {
  async registerOptions(_req: Request, res: Response) {
    const options = await webauthnService.registerOptions();
    res.json(options);
  },

  async registerVerify(req: Request, res: Response) {
    const result = await webauthnService.registerVerify(req.body);
    res.json(result);
  },

  async loginOptions(_req: Request, res: Response) {
    const options = await webauthnService.loginOptions();
    res.json(options);
  },

  async loginVerify(req: Request, res: Response) {
    const result = await webauthnService.loginVerify(req.body);
    res.json(result);
  },
};
