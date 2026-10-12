import type { Purchase, Transaction } from '@/types/entities';
import { generateInstallments } from '../logic/purchase-installments';
import { invalid } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  assertRefs,
  findOr404,
  newId,
  nowIso,
  parseDate,
  parseIntInRange,
  parseMoney,
  parseText,
  requireString,
} from './shared';

// Espelha backend/src/{services/purchase.service,repositories/purchase.repository}.ts.

const NOT_FOUND = 'Compra não encontrada';

// createPurchaseSchema — usado tanto no POST quanto no PUT (o PUT exige o body completo).
function parsePurchase(body: Record<string, unknown>) {
  return {
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valorTotal: parseMoney(body.valorTotal),
    descricao: requireString(body.descricao),
    dataCompra: parseDate(body.dataCompra),
    numeroParcelas: parseIntInRange(
      body.numeroParcelas,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    terceiro: parseTerceiro(body.terceiro),
  };
}

// z.string().trim().max(60).nullish().transform((v) => v || null)
function parseTerceiro(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const terceiro = parseText(value).trim();
  if (terceiro.length > 60) throw invalid();
  return terceiro || null;
}

function installmentTransactions(purchase: Purchase): Transaction[] {
  const createdAt = nowIso();
  return generateInstallments({
    valorTotal: purchase.valorTotal,
    numeroParcelas: purchase.numeroParcelas,
    dataCompra: new Date(purchase.dataCompra),
  }).map((parcela) => ({
    id: newId(),
    accountId: purchase.accountId,
    categoryId: purchase.categoryId,
    valor: parcela.valor.toString(),
    descricao: purchase.descricao,
    data: parcela.data.toISOString(),
    tipo: 'DESPESA',
    purchaseId: purchase.id,
    fixedExpenseId: null,
    parcelaNumero: parcela.parcelaNumero,
    parcelaTotal: parcela.parcelaTotal,
    terceiro: purchase.terceiro,
    createdAt,
  }));
}

export function createPurchase(
  db: DemoDb,
  body: Record<string, unknown>,
): Purchase {
  const input = parsePurchase(body);
  assertRefs(db, input.accountId, input.categoryId);
  const purchase: Purchase = { id: newId(), ...input, createdAt: nowIso() };
  db.purchases.push(purchase);
  db.transactions.push(...installmentTransactions(purchase));
  return purchase;
}

function updatePurchase(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Purchase {
  const input = parsePurchase(body);
  const purchase = findOr404(db.purchases, id, NOT_FOUND);
  assertRefs(db, input.accountId, input.categoryId);
  Object.assign(purchase, input);
  db.transactions = db.transactions.filter((t) => t.purchaseId !== id);
  db.transactions.push(...installmentTransactions(purchase));
  return purchase;
}

function removePurchase(db: DemoDb, id: string): void {
  findOr404(db.purchases, id, NOT_FOUND);
  db.transactions = db.transactions.filter((t) => t.purchaseId !== id);
  db.purchases = db.purchases.filter((p) => p.id !== id);
}

export const purchaseRoutes: Route[] = [
  { method: 'GET', pattern: '/purchases', handler: ({ db }) => db.purchases },
  {
    method: 'GET',
    pattern: '/purchases/:id',
    handler: ({ db, params }) => findOr404(db.purchases, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/purchases',
    handler: ({ db, body }) => createPurchase(db, body),
  },
  {
    method: 'PUT',
    pattern: '/purchases/:id',
    handler: ({ db, params, body }) => updatePurchase(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/purchases/:id',
    handler: ({ db, params }) => removePurchase(db, params.id),
  },
];
