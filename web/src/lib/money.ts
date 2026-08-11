// Money fields from the API are Prisma Decimal serialized as strings with variable precision
// (e.g. "100.5", not "100.50") — see docs/api.md. Never treat them as numbers directly.

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** API decimal string (or number) -> display string, e.g. "100.5" -> "R$ 100,50". */
export function formatMoney(value: string | number): string {
  const number = typeof value === 'string' ? Number(value) : value;
  return currencyFormatter.format(Number.isFinite(number) ? number : 0);
}

/** Integer cents -> API decimal string, e.g. 10050 -> "100.50". Pairs with a digits-only money input. */
export function centsToApiString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** API decimal string -> integer cents, e.g. "100.5" -> 10050. Used to seed a money input when editing. */
export function apiStringToCents(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}
