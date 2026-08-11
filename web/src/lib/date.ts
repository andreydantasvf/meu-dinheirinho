import { addMonths, format, parse, parseISO } from 'date-fns';
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

/** "2026-08" -> "2026-09" / "2026-07" — Extrato prev/next month navigation. */
export function shiftMonth(mes: string, delta: number): string {
  return format(addMonths(parse(mes, 'yyyy-MM', new Date()), delta), 'yyyy-MM');
}
