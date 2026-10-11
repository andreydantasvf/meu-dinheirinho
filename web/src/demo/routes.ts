import { accountRoutes } from './handlers/accounts';
import { categoryRoutes } from './handlers/categories';
import { fixedExpenseRoutes } from './handlers/fixed-expenses';
import { purchaseRoutes } from './handlers/purchases';
import { transactionRoutes } from './handlers/transactions';
import type { Route } from './router';

// Tabela de endpoints da API falsa — um bloco por entidade, espelhando backend/src/routes/.
export const routes: Route[] = [
  ...accountRoutes,
  ...categoryRoutes,
  ...transactionRoutes,
  ...purchaseRoutes,
  ...fixedExpenseRoutes,
];
