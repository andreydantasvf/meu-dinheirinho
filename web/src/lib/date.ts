import { addMonths, format, parse, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** ISO date string from the API -> "10 de ago." for display in lists. */
export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "d 'de' MMM.", { locale: ptBR });
}

/** ISO date string from the API -> "10/08/2026" for form defaults / detail views. */
export function formatDateFull(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
}

/** "2026-08" -> "Agosto de 2026", used as the Extrato month-picker label. */
export function formatMonthLabel(mes: string): string {
  const label = format(parse(mes, 'yyyy-MM', new Date()), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Today as "2026-08" — default value for the Extrato month filter and dashboards. */
export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/** Local midnight of today as ISO — default date for new forms, same shape DatePickerField emits.
 * Never `new Date().toISOString()`: at night in UTC-3 the UTC date is already tomorrow, and the
 * backend buckets months in UTC. Call it when the form mounts, not at module load, or a PWA left
 * open for days keeps an old "today". */
export function todayLocalIso(): string {
  return startOfDay(new Date()).toISOString();
}

/** "2026-08" -> "2026-09" / "2026-07" — Extrato prev/next month navigation. */
export function shiftMonth(mes: string, delta: number): string {
  return format(addMonths(parse(mes, 'yyyy-MM', new Date()), delta), 'yyyy-MM');
}

// Date-only fields (e.g. a reminder's dataUnica) are stored as UTC midnight of the chosen
// calendar day. Reading them in local time would shift the day back in UTC-3, so these
// helpers go through the UTC parts explicitly.

/** UTC-midnight ISO from the API -> "05/12/2026". */
export function formatUtcDate(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

/** UTC-midnight ISO from the API -> local-midnight ISO, for seeding DatePickerField. */
export function utcDateToLocalIso(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toISOString();
}

/** DatePickerField's local ISO -> "2026-12-05", for date-only API fields. */
export function localIsoToDateOnly(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}
