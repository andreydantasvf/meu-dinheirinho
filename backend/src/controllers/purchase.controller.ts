import type { Request, Response } from 'express';
import { purchaseService } from '../services/purchase.service';
import { createPurchaseSchema } from '../validators/purchase.schema';

type IdParams = { id: string };

export const purchaseController = {
  async list(_req: Request, res: Response) {
    const purchases = await purchaseService.list();
    res.json(purchases);
  },

  async get(req: Request<IdParams>, res: Response) {
    const purchase = await purchaseService.get(req.params.id);
    res.json(purchase);
  },

  async create(req: Request, res: Response) {
    const data = createPurchaseSchema.parse(req.body);
    const purchase = await purchaseService.create(data);
    res.status(201).json(purchase);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = createPurchaseSchema.parse(req.body);
    const purchase = await purchaseService.update(req.params.id, data);
    res.json(purchase);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await purchaseService.remove(req.params.id);
    res.status(204).send();
  },
};
