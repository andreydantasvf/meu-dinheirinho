import type { Request, Response } from 'express';
import { accountService } from '../services/account.service';
import {
  createAccountSchema,
  updateAccountSchema,
} from '../validators/account.schema';

type IdParams = { id: string };

export const accountController = {
  async list(_req: Request, res: Response) {
    const accounts = await accountService.list();
    res.json(accounts);
  },

  async get(req: Request<IdParams>, res: Response) {
    const account = await accountService.get(req.params.id);
    res.json(account);
  },

  async create(req: Request, res: Response) {
    const data = createAccountSchema.parse(req.body);
    const account = await accountService.create(data);
    res.status(201).json(account);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateAccountSchema.parse(req.body);
    const account = await accountService.update(req.params.id, data);
    res.json(account);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await accountService.remove(req.params.id);
    res.status(204).send();
  },
};
