import type { Category } from '@/types/entities';
import { internalError } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  oneOf,
  optionalField,
  parseMoney,
  parseText,
  requireString,
} from './shared';

// Espelha backend/src/{services/category.service,validators/category.schema}.ts.

const TIPOS = ['RECEITA', 'DESPESA'] as const;
const NOT_FOUND = 'Categoria não encontrada';

// metaMensal: null explícito remove a meta; ausente não altera (no create vira null).
function parseMeta(value: unknown): string | null {
  return value === null ? null : parseMoney(value, { centavos: false });
}

function createCategory(db: DemoDb, body: Record<string, unknown>): Category {
  const category: Category = {
    id: newId(),
    nome: requireString(body.nome),
    tipo: oneOf(body.tipo, TIPOS),
    icone: optionalField(body, 'icone', parseText) ?? null,
    cor: optionalField(body, 'cor', parseText) ?? null,
    metaMensal: optionalField(body, 'metaMensal', parseMeta) ?? null,
  };
  db.categories.push(category);
  return category;
}

function updateCategory(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Category {
  const changes = definedOnly({
    nome: optionalField(body, 'nome', requireString),
    tipo: optionalField(body, 'tipo', (v) => oneOf(v, TIPOS)),
    icone: optionalField(body, 'icone', parseText),
    cor: optionalField(body, 'cor', parseText),
    metaMensal: optionalField(body, 'metaMensal', parseMeta),
  });
  // definedOnly só descarta undefined: metaMensal null (remover a meta) passa adiante.
  const category = findOr404(db.categories, id, NOT_FOUND);
  Object.assign(category, changes);
  return category;
}

function removeCategory(db: DemoDb, id: string): void {
  findOr404(db.categories, id, NOT_FOUND);
  const emUso =
    db.transactions.some((t) => t.categoryId === id) ||
    db.purchases.some((p) => p.categoryId === id) ||
    db.fixedExpenses.some((f) => f.categoryId === id);
  if (emUso) throw internalError();
  db.categories = db.categories.filter((c) => c.id !== id);
}

export const categoryRoutes: Route[] = [
  { method: 'GET', pattern: '/categories', handler: ({ db }) => db.categories },
  {
    method: 'GET',
    pattern: '/categories/:id',
    handler: ({ db, params }) => findOr404(db.categories, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/categories',
    handler: ({ db, body }) => createCategory(db, body),
  },
  {
    method: 'PUT',
    pattern: '/categories/:id',
    handler: ({ db, params, body }) => updateCategory(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/categories/:id',
    handler: ({ db, params }) => removeCategory(db, params.id),
  },
];
