import { Router } from 'express';
import { categoryRoutes } from './category.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/categories', categoryRoutes);
