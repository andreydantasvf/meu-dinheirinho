import type { Request, Response } from 'express';
import { pushService } from '../services/push.service';
import {
  pushSubscriptionSchema,
  unsubscribeSchema,
} from '../validators/push.schema';

export const pushController = {
  config(_req: Request, res: Response) {
    res.json(pushService.config());
  },

  async subscribe(req: Request, res: Response) {
    const data = pushSubscriptionSchema.parse(req.body);
    await pushService.subscribe(data);
    res.status(201).json({ ok: true });
  },

  async unsubscribe(req: Request, res: Response) {
    const { endpoint } = unsubscribeSchema.parse(req.body);
    await pushService.unsubscribe(endpoint);
    res.status(204).send();
  },
};
