import { Router } from 'express';
import { accountRoutes } from './account.routes';
import { categoryRoutes } from './category.routes';
import { purchaseRoutes } from './purchase.routes';
import { transactionRoutes } from './transaction.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/categories', categoryRoutes);
routes.use('/accounts', accountRoutes);
routes.use('/transactions', transactionRoutes);
routes.use('/purchases', purchaseRoutes);
