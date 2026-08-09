import type { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import { extratoQuerySchema } from '../validators/extrato.schema';

type AccountIdParams = { id: string };

export const reportsController = {
  async dashboard(_req: Request, res: Response) {
    const dashboard = await reportsService.dashboard();
    res.json(dashboard);
  },

  async extrato(req: Request, res: Response) {
    const { mes, categoriaId, accountId } = extratoQuerySchema.parse(req.query);

    const transactions = await reportsService.extrato({ mes, categoriaId, accountId });
    res.json(transactions);
  },

  async fatura(req: Request<AccountIdParams>, res: Response) {
    const fatura = await reportsService.fatura(req.params.id);
    res.json(fatura);
  },
};
