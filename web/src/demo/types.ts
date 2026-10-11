import type {
  Account,
  Category,
  Purchase,
  Reminder,
  Transaction,
} from '@/types/entities';

// Gasto fixo como o backend serializa (o web não tem tipo próprio porque nunca lista gastos fixos).
export type FixedExpense = {
  id: string;
  accountId: string;
  categoryId: string;
  valor: string;
  descricao: string;
  dataInicio: string;
  status: 'ACTIVE' | 'CANCELED';
  createdAt: string;
};

// O "banco" da demo. Os registros ficam no formato JSON da API (dinheiro como string
// Decimal, datas ISO), então responder um GET é só devolver uma cópia.
export type DemoDb = {
  version: number;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  purchases: Purchase[];
  fixedExpenses: FixedExpense[];
  reminders: Reminder[];
};
