import type { DemoDb } from './types';

// Bump ao mudar o formato do DemoDb ou o seed: bancos salvos com outra versão são descartados.
export const DEMO_DB_VERSION = 1;

export function createSeed(_hoje: Date): DemoDb {
  return {
    version: DEMO_DB_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    purchases: [],
    fixedExpenses: [],
    reminders: [],
  };
}
