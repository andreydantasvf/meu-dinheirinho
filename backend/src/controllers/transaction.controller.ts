import type { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import { createTransactionSchema, updateTransactionSchema } from '../validators/transaction.schema';

type IdParams = { id: string };

export const transactionController = {
  async list(_req: Request, res: Response) {
    const transactions = await transactionService.list();
    res.json(transactions);
  },

  async get(req: Request<IdParams>, res: Response) {
    const transaction = await transactionService.get(req.params.id);
    res.json(transaction);
  },

  async create(req: Request, res: Response) {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await transactionService.create(data);
    res.status(201).json(transaction);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateTransactionSchema.parse(req.body);
    const transaction = await transactionService.update(req.params.id, data);
    res.json(transaction);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await transactionService.remove(req.params.id);
    res.status(204).send();
  },
};
