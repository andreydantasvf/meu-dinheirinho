import type { Request, Response } from 'express';
import { fixedExpenseService } from '../services/fixed-expense.service';
import { createFixedExpenseSchema } from '../validators/fixed-expense.schema';

export const fixedExpenseController = {
  async list(req: Request, res: Response) {
    const expenses = await fixedExpenseService.list();
    res.json(expenses);
  },

  async get(req: Request, res: Response) {
    const expense = await fixedExpenseService.get(req.params.id as string);
    res.json(expense);
  },

  async create(req: Request, res: Response) {
    const data = createFixedExpenseSchema.parse(req.body);
    const expense = await fixedExpenseService.create(data);
    res.status(201).json(expense);
  },

  async remove(req: Request, res: Response) {
    await fixedExpenseService.remove(req.params.id as string);
    res.status(204).send();
  },
};
