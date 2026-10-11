import Decimal from 'decimal.js';
import { DemoHttpError, internalError, invalid } from '../errors';
import type { DemoDb } from '../types';

// crypto.randomUUID só existe em contexto seguro (HTTPS/localhost); abrir a demo pelo IP da
// rede local (ex.: testar no iPhone) cai no fallback.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function findOr404<T extends { id: string }>(
  list: T[],
  id: string,
  message: string,
): T {
  const item = list.find((i) => i.id === id);
  if (!item) throw new DemoHttpError(404, message);
  return item;
}

// z.coerce.number().positive() (+ .multipleOf(0.01) quando `centavos`) → string Decimal,
// como o Prisma serializa ("100.50" vira "100.5").
export function parseMoney(
  value: unknown,
  { centavos = true }: { centavos?: boolean } = {},
): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n <= 0) {
    throw invalid();
  }
  const decimal = new Decimal(n);
  if (centavos && !decimal.times(100).isInteger()) throw invalid();
  return decimal.toString();
}

// z.coerce.date(): "2026-08-01" vira meia-noite UTC; ISO completo mantém o instante.
export function parseDate(value: unknown): string {
  if (value === null || value === undefined || value === '') throw invalid();
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString();
}

// z.string().min(1)
export function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw invalid();
  return value;
}

// z.string() (aceita string vazia)
export function parseText(value: unknown): string {
  if (typeof value !== 'string') throw invalid();
  return value;
}

// z.coerce.number().int().min(min).max(max)
export function parseIntInRange(
  value: unknown,
  min: number,
  max: number,
): number {
  const n = Number(value);
  if (
    value === null ||
    value === '' ||
    !Number.isInteger(n) ||
    n < min ||
    n > max
  ) {
    throw invalid();
  }
  return n;
}

export function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): T {
  if (!options.includes(value as T)) throw invalid();
  return value as T;
}

// Campo opcional (create) ou de update parcial: ausente/undefined = "não mexer".
export function optionalField<T>(
  body: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => T,
): T | undefined {
  return body[key] === undefined ? undefined : parse(body[key]);
}

export function definedOnly<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

// No backend, conta/categoria inexistente estoura a foreign key → 500 genérico.
export function assertRefs(
  db: DemoDb,
  accountId: string,
  categoryId: string,
): void {
  const accountOk = db.accounts.some((a) => a.id === accountId);
  const categoryOk = db.categories.some((c) => c.id === categoryId);
  if (!accountOk || !categoryOk) throw internalError();
}
