// Cálculo puro do próximo disparo de um lembrete. Dia/horário são configurados no
// fuso do usuário (REMINDERS_TZ), mas tudo é persistido em UTC — a conversão usa
// Intl.DateTimeFormat para não depender de lib de timezone.

export type ReminderScheduleInput = {
  recorrencia: 'MENSAL' | 'UNICO';
  diaDoMes: number | null;
  dataUnica: Date | null;
  horario: string;
  diasAntecedencia: number;
};

type LocalParts = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
};

const MAX_MESES_BUSCA = 14;

export function partesNoFuso(date: Date, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

// Diferença (ms) entre o relógio local em `tz` e UTC no instante `date`.
function offsetDoFuso(date: Date, tz: string): number {
  const p = partesNoFuso(date, tz);
  const comoUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
  const truncado = Math.floor(date.getTime() / 60_000) * 60_000;
  return comoUtc - truncado;
}

// Converte um horário de parede em `tz` para o instante UTC correspondente.
// Date.UTC normaliza overflow de dia (ex.: day = 0 vira o último dia do mês anterior).
export function horarioLocalParaUtc(local: LocalParts, tz: string): Date {
  const palpite = Date.UTC(
    local.year,
    local.month,
    local.day,
    local.hour,
    local.minute,
  );
  let resultado = palpite - offsetDoFuso(new Date(palpite), tz);
  // Segunda passada corrige o caso em que o offset muda entre o palpite e o resultado (DST).
  resultado = palpite - offsetDoFuso(new Date(resultado), tz);
  return new Date(resultado);
}

function parseHorario(horario: string): { hour: number; minute: number } {
  const [hour, minute] = horario.split(':').map(Number);
  return { hour, minute };
}

function ultimoDiaDoMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function disparoParaEvento(
  evento: { year: number; month: number; day: number },
  reminder: ReminderScheduleInput,
  tz: string,
): Date {
  return horarioLocalParaUtc(
    {
      year: evento.year,
      month: evento.month,
      day: evento.day - reminder.diasAntecedencia,
      ...parseHorario(reminder.horario),
    },
    tz,
  );
}

// Primeiro disparo estritamente depois de `agora`, ou null se não houver mais nenhum
// (lembrete único que já passou).
export function calcularProximoDisparo(
  reminder: ReminderScheduleInput,
  agora: Date,
  tz: string,
): Date | null {
  if (reminder.recorrencia === 'UNICO') {
    if (!reminder.dataUnica) return null;
    const disparo = disparoParaEvento(
      {
        year: reminder.dataUnica.getUTCFullYear(),
        month: reminder.dataUnica.getUTCMonth(),
        day: reminder.dataUnica.getUTCDate(),
      },
      reminder,
      tz,
    );
    return disparo > agora ? disparo : null;
  }

  if (!reminder.diaDoMes) return null;
  const hoje = partesNoFuso(agora, tz);
  // Começa no mês atual: a ocorrência de um mês nunca dispara depois do próprio mês,
  // então meses anteriores já estão no passado.
  for (let i = 0; i < MAX_MESES_BUSCA; i++) {
    const inicioMes = new Date(Date.UTC(hoje.year, hoje.month + i, 1));
    const year = inicioMes.getUTCFullYear();
    const month = inicioMes.getUTCMonth();
    const day = Math.min(reminder.diaDoMes, ultimoDiaDoMes(year, month));
    const disparo = disparoParaEvento({ year, month, day }, reminder, tz);
    if (disparo > agora) return disparo;
  }
  return null;
}

// Data (no fuso do usuário) do evento lembrado por um disparo — o disparo acontece
// `diasAntecedencia` dias antes do evento.
export function dataDoEvento(
  disparo: Date,
  diasAntecedencia: number,
  tz: string,
): Date {
  const p = partesNoFuso(disparo, tz);
  return new Date(Date.UTC(p.year, p.month, p.day + diasAntecedencia));
}
