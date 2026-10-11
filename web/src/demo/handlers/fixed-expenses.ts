import type { Transaction } from '@/types/entities';
import {
  addMonthsClamped,
  generateFixedExpenseTransactions,
} from '../logic/fixed-expense-generator';
import type { Route } from '../router';
import type { DemoDb, FixedExpense } from '../types';
import {
  assertRefs,
  findOr404,
  newId,
  nowIso,
  parseDate,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/fixed-expense.service,repositories/fixed-expense.repository}.ts.

const HORIZON_MONTHS = 12;
const NOT_FOUND = 'Despesa fixa não encontrada';

function fixedTransaction(
  expense: FixedExpense,
  valor: string,
  data: Date,
): Transaction {
  return {
    id: newId(),
    accountId: expense.accountId,
    categoryId: expense.categoryId,
    valor,
    descricao: expense.descricao,
    data: data.toISOString(),
    tipo: 'DESPESA',
    purchaseId: null,
    fixedExpenseId: expense.id,
    parcelaNumero: null,
    parcelaTotal: null,
    createdAt: nowIso(),
  };
}

export function createFixedExpense(
  db: DemoDb,
  body: Record<string, unknown>,
): FixedExpense {
  const expense: FixedExpense = {
    id: newId(),
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valor: parseMoney(body.valor),
    descricao: requireString(body.descricao),
    dataInicio: parseDate(body.dataInicio),
    status: 'ACTIVE',
    createdAt: nowIso(),
  };
  assertRefs(db, expense.accountId, expense.categoryId);
  db.fixedExpenses.push(expense);
  const geradas = generateFixedExpenseTransactions({
    valor: expense.valor,
    dataInicio: new Date(expense.dataInicio),
    quantidadeMeses: HORIZON_MONTHS,
  });
  for (const t of geradas) {
    db.transactions.push(fixedTransaction(expense, t.valor.toString(), t.data));
  }
  return expense;
}

// Cancela (soft-delete): apaga só as transações com data ≥ hoje (UTC) e desativa os
// lembretes ligados — mesmo comportamento de fixedExpenseService.remove.
function removeFixedExpense(db: DemoDb, id: string): void {
  const expense = findOr404(db.fixedExpenses, id, NOT_FOUND);
  const agora = new Date();
  const hojeUTC = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  );
  db.transactions = db.transactions.filter(
    (t) => !(t.fixedExpenseId === id && new Date(t.data) >= hojeUTC),
  );
  expense.status = 'CANCELED';
  const now = nowIso();
  for (const reminder of db.reminders) {
    if (reminder.fixedExpenseId === id) {
      reminder.ativo = false;
      reminder.updatedAt = now;
    }
  }
}

// Port de fixedExpenseService.ensureHorizon (no backend: cron diário + startup). Continua a
// partir da última transação gerada — inclusive o drift de dia 31 → 28 descrito no spec.
export function ensureHorizon(db: DemoDb, agora: Date): void {
  const targetDate = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + HORIZON_MONTHS, 1),
  );
  for (const expense of db.fixedExpenses) {
    if (expense.status !== 'ACTIVE') continue;
    const datas = db.transactions
      .filter((t) => t.fixedExpenseId === expense.id)
      .map((t) => new Date(t.data).getTime());
    if (datas.length === 0) continue;

    let current = addMonthsClamped(new Date(Math.max(...datas)), 1);
    while (current <= targetDate) {
      db.transactions.push(fixedTransaction(expense, expense.valor, current));
      current = addMonthsClamped(current, 1);
    }
  }
}

export const fixedExpenseRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/fixed-expenses',
    handler: ({ db }) => db.fixedExpenses,
  },
  {
    method: 'GET',
    pattern: '/fixed-expenses/:id',
    handler: ({ db, params }) =>
      findOr404(db.fixedExpenses, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/fixed-expenses',
    handler: ({ db, body }) => createFixedExpense(db, body),
  },
  {
    method: 'DELETE',
    pattern: '/fixed-expenses/:id',
    handler: ({ db, params }) => removeFixedExpense(db, params.id),
  },
];
