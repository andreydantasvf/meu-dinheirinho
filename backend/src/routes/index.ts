import { Router } from 'express';
import { requireAuth } from '../middlewares/require-auth';
import { accountRoutes } from './account.routes';
import { authRoutes } from './auth.routes';
import { categoryRoutes } from './category.routes';
import { purchaseRoutes } from './purchase.routes';
import { pushRoutes } from './push.routes';
import { reminderRoutes } from './reminder.routes';
import { reportsRoutes } from './reports.routes';
import { transactionRoutes } from './transaction.routes';
import { fixedExpenseRouter } from './fixed-expense.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/auth', authRoutes);
routes.use(requireAuth);

routes.use('/categories', categoryRoutes);
routes.use('/accounts', accountRoutes);
routes.use('/transactions', transactionRoutes);
routes.use('/purchases', purchaseRoutes);
routes.use('/fixed-expenses', fixedExpenseRouter);
routes.use('/reminders', reminderRoutes);
routes.use('/push', pushRoutes);
routes.use(reportsRoutes);
