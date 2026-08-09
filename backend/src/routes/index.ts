import { Router } from 'express';
import { accountRoutes } from './account.routes';
import { categoryRoutes } from './category.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/categories', categoryRoutes);
routes.use('/accounts', accountRoutes);
