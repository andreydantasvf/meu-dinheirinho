import type { Prisma } from '../generated/prisma/client.js';
import { dataDoEvento, partesNoFuso } from '../services/reminder-schedule';

export type NotificationMessage = {
  title: string;
  body: string;
  tipo: 'ENTRADA' | 'SAIDA';
  path: string;
};

type ReminderForMessage = {
  titulo: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: Prisma.Decimal | null;
  diasAntecedencia: number;
};

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const DIA_MS = 24 * 60 * 60 * 1000;

// Rótulo relativo ao dia de hoje (não ao disparo), para que um disparo atrasado —
// servidor fora do ar — não diga "hoje" sobre algo que já passou.
function quando(evento: Date, agora: Date, tz: string): string {
  const hoje = partesNoFuso(agora, tz);
  const dias = Math.round(
    (evento.getTime() - Date.UTC(hoje.year, hoje.month, hoje.day)) / DIA_MS,
  );
  const dia = String(evento.getUTCDate()).padStart(2, '0');
  const mes = String(evento.getUTCMonth() + 1).padStart(2, '0');
  if (dias < 0) return `venceu em ${dia}/${mes}`;
  if (dias === 0) return `hoje (${dia}/${mes})`;
  if (dias === 1) return `amanhã (${dia}/${mes})`;
  return `em ${dias} dias (${dia}/${mes})`;
}

// `disparo` é o disparo agendado; a data do evento lembrado fica `diasAntecedencia`
// dias depois, no fuso do usuário.
export function montarMensagem(
  reminder: ReminderForMessage,
  disparo: Date,
  agora: Date,
  tz: string,
): NotificationMessage {
  const evento = dataDoEvento(disparo, reminder.diasAntecedencia, tz);
  const prefixo = reminder.tipo === 'ENTRADA' ? 'Recebimento' : 'Pagamento';
  const partes = [quando(evento, agora, tz)];
  if (reminder.valor) {
    partes.unshift(brl.format(Number(reminder.valor.toString())));
  }
  return {
    title: `${prefixo}: ${reminder.titulo}`,
    body: partes.join(' · '),
    tipo: reminder.tipo,
    path: '/lembretes',
  };
}
