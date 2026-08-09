import type { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';

type AccountIdParams = { id: string };

export const reportsController = {
  async dashboard(_req: Request, res: Response) {
    const dashboard = await reportsService.dashboard();
    res.json(dashboard);
  },

  async extrato(req: Request, res: Response) {
    const mes = String(req.query.mes ?? '');
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      res.status(400).json({ error: 'Parâmetro mes é obrigatório no formato YYYY-MM' });
      return;
    }
    const categoriaId = req.query.categoriaId ? String(req.query.categoriaId) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;

    const transactions = await reportsService.extrato({ mes, categoriaId, accountId });
    res.json(transactions);
  },

  async fatura(req: Request<AccountIdParams>, res: Response) {
    const fatura = await reportsService.fatura(req.params.id);
    res.json(fatura);
  },
};
