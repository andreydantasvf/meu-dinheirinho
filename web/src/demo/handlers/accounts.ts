import type { Account } from '@/types/entities';
import { DemoHttpError, invalid } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseIntInRange,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/account.service,validators/account.schema}.ts.

const TIPOS = ['CONTA_CORRENTE', 'DINHEIRO', 'CARTAO_CREDITO'] as const;
const NOT_FOUND = 'Conta não encontrada';

// Refine do schema: tipo CARTAO_CREDITO exige limite, diaFechamento e diaVencimento no mesmo body.
function parseCardFields(
  body: Record<string, unknown>,
  tipo: Account['tipo'] | undefined,
) {
  const limite = optionalField(body, 'limite', (v) =>
    parseMoney(v, { centavos: false }),
  );
  const diaFechamento = optionalField(body, 'diaFechamento', (v) =>
    parseIntInRange(v, 1, 31),
  );
  const diaVencimento = optionalField(body, 'diaVencimento', (v) =>
    parseIntInRange(v, 1, 31),
  );
  if (
    tipo === 'CARTAO_CREDITO' &&
    (limite === undefined ||
      diaFechamento === undefined ||
      diaVencimento === undefined)
  ) {
    throw invalid();
  }
  return { limite, diaFechamento, diaVencimento };
}

export function createAccount(
  db: DemoDb,
  body: Record<string, unknown>,
): Account {
  const nome = requireString(body.nome);
  const tipo = oneOf(body.tipo, TIPOS);
  const card = parseCardFields(body, tipo);
  const now = nowIso();
  const account: Account = {
    id: newId(),
    nome,
    tipo,
    limite: card.limite ?? null,
    diaFechamento: card.diaFechamento ?? null,
    diaVencimento: card.diaVencimento ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.accounts.push(account);
  return account;
}

function updateAccount(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Account {
  const tipo = optionalField(body, 'tipo', (v) => oneOf(v, TIPOS));
  const changes = definedOnly({
    nome: optionalField(body, 'nome', requireString),
    tipo,
    ...parseCardFields(body, tipo),
  });
  const account = findOr404(db.accounts, id, NOT_FOUND);
  Object.assign(account, changes, { updatedAt: nowIso() });
  return account;
}

function removeAccount(db: DemoDb, id: string): void {
  findOr404(db.accounts, id, NOT_FOUND);
  const emUso =
    db.transactions.some((t) => t.accountId === id) ||
    db.purchases.some((p) => p.accountId === id) ||
    db.fixedExpenses.some((f) => f.accountId === id);
  if (emUso) {
    throw new DemoHttpError(
      409,
      'Não é possível excluir uma conta com lançamentos',
    );
  }
  db.accounts = db.accounts.filter((a) => a.id !== id);
}

export const accountRoutes: Route[] = [
  { method: 'GET', pattern: '/accounts', handler: ({ db }) => db.accounts },
  {
    method: 'GET',
    pattern: '/accounts/:id',
    handler: ({ db, params }) => findOr404(db.accounts, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/accounts',
    handler: ({ db, body }) => createAccount(db, body),
  },
  {
    method: 'PUT',
    pattern: '/accounts/:id',
    handler: ({ db, params, body }) => updateAccount(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/accounts/:id',
    handler: ({ db, params }) => removeAccount(db, params.id),
  },
];
