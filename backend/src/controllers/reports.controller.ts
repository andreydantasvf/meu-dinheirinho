import type { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import { dashboardQuerySchema, extratoQuerySchema } from '../validators/reports.schema';

type AccountIdParams = { id: string };

export const reportsController = {
  async dashboard(req: Request, res: Response) {
    const { mes } = dashboardQuerySchema.parse(req.query);
    const dashboard = await reportsService.dashboard(mes);
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
