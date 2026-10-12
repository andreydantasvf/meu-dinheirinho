import type { Transaction } from '@/types/entities';
import { DemoHttpError } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  assertRefs,
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseDate,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/transaction.service,validators/transaction.schema}.ts.

const TIPOS = ['RECEITA', 'DESPESA'] as const;
const NOT_FOUND = 'Transação não encontrada';
const PARCELADA =
  'Transação de compra parcelada não pode ser editada diretamente';

export function createTransaction(
  db: DemoDb,
  body: Record<string, unknown>,
): Transaction {
  const transaction: Transaction = {
    id: newId(),
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valor: parseMoney(body.valor),
    descricao: requireString(body.descricao),
    data: parseDate(body.data),
    tipo: oneOf(body.tipo, TIPOS),
    purchaseId: null,
    fixedExpenseId: null,
    parcelaNumero: null,
    parcelaTotal: null,
    terceiro: null,
    createdAt: nowIso(),
  };
  assertRefs(db, transaction.accountId, transaction.categoryId);
  db.transactions.push(transaction);
  return transaction;
}

function updateTransaction(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Transaction {
  const changes = definedOnly({
    accountId: optionalField(body, 'accountId', requireString),
    categoryId: optionalField(body, 'categoryId', requireString),
    valor: optionalField(body, 'valor', (v) => parseMoney(v)),
    descricao: optionalField(body, 'descricao', requireString),
    data: optionalField(body, 'data', parseDate),
    tipo: optionalField(body, 'tipo', (v) => oneOf(v, TIPOS)),
  });
  const transaction = findOr404(db.transactions, id, NOT_FOUND);
  if (transaction.purchaseId) throw new DemoHttpError(400, PARCELADA);
  assertRefs(
    db,
    changes.accountId ?? transaction.accountId,
    changes.categoryId ?? transaction.categoryId,
  );
  Object.assign(transaction, changes);
  return transaction;
}

function removeTransaction(db: DemoDb, id: string): void {
  const transaction = findOr404(db.transactions, id, NOT_FOUND);
  if (transaction.purchaseId) throw new DemoHttpError(400, PARCELADA);
  db.transactions = db.transactions.filter((t) => t.id !== id);
}

export const transactionRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/transactions',
    handler: ({ db }) => db.transactions,
  },
  {
    method: 'GET',
    pattern: '/transactions/:id',
    handler: ({ db, params }) =>
      findOr404(db.transactions, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/transactions',
    handler: ({ db, body }) => createTransaction(db, body),
  },
  {
    method: 'PUT',
    pattern: '/transactions/:id',
    handler: ({ db, params, body }) => updateTransaction(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/transactions/:id',
    handler: ({ db, params }) => removeTransaction(db, params.id),
  },
];
