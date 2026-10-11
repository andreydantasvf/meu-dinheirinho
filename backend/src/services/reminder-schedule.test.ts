import { describe, expect, it } from 'vitest';
import {
  calcularProximoDisparo,
  dataDoEvento,
  horarioLocalParaUtc,
  type ReminderScheduleInput,
} from './reminder-schedule';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão desde 2019

function mensal(
  diaDoMes: number,
  extra: Partial<ReminderScheduleInput> = {},
): ReminderScheduleInput {
  return {
    recorrencia: 'MENSAL',
    diaDoMes,
    dataUnica: null,
    horario: '09:00',
    diasAntecedencia: 0,
    ...extra,
  };
}

describe('horarioLocalParaUtc', () => {
  it('converts a São Paulo wall-clock time to UTC (+3h)', () => {
    const result = horarioLocalParaUtc(
      { year: 2026, month: 9, day: 25, hour: 9, minute: 0 },
      TZ,
    );
    expect(result.toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });

  it('handles a timezone with DST (New York, summer vs winter)', () => {
    const verao = horarioLocalParaUtc(
      { year: 2026, month: 6, day: 1, hour: 9, minute: 0 },
      'America/New_York',
    );
    const inverno = horarioLocalParaUtc(
      { year: 2026, month: 0, day: 1, hour: 9, minute: 0 },
      'America/New_York',
    );
    expect(verao.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(inverno.toISOString()).toBe('2026-01-01T14:00:00.000Z');
  });
});

describe('calcularProximoDisparo — MENSAL', () => {
  it('fires later this month when the day has not passed yet', () => {
    const agora = new Date('2026-10-11T15:00:00Z');
    expect(calcularProximoDisparo(mensal(25), agora, TZ)?.toISOString()).toBe(
      '2026-10-25T12:00:00.000Z',
    );
  });

  it('fires today when the time has not passed yet', () => {
    const agora = new Date('2026-10-25T11:59:00Z'); // 08:59 em SP
    expect(calcularProximoDisparo(mensal(25), agora, TZ)?.toISOString()).toBe(
      '2026-10-25T12:00:00.000Z',
    );
  });

  it('rolls to next month once today’s fire time has passed', () => {
    const agora = new Date('2026-10-25T12:00:00Z'); // exatamente no disparo
    expect(calcularProximoDisparo(mensal(25), agora, TZ)?.toISOString()).toBe(
      '2026-11-25T12:00:00.000Z',
    );
  });

  it('clamps day 31 to the last day of a short month (February)', () => {
    const agora = new Date('2027-02-01T12:00:00Z');
    expect(calcularProximoDisparo(mensal(31), agora, TZ)?.toISOString()).toBe(
      '2027-02-28T12:00:00.000Z',
    );
  });

  it('applies diasAntecedencia, crossing into the previous month', () => {
    // evento dia 2/nov, 3 dias antes = 30/out
    const agora = new Date('2026-10-11T15:00:00Z');
    const result = calcularProximoDisparo(
      mensal(2, { diasAntecedencia: 3 }),
      agora,
      TZ,
    );
    expect(result?.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  it('uses the configured horario', () => {
    const agora = new Date('2026-10-11T15:00:00Z');
    const result = calcularProximoDisparo(
      mensal(25, { horario: '20:30' }),
      agora,
      TZ,
    );
    expect(result?.toISOString()).toBe('2026-10-25T23:30:00.000Z');
  });

  it('crosses the year boundary', () => {
    const agora = new Date('2026-12-20T15:00:00Z');
    expect(calcularProximoDisparo(mensal(10), agora, TZ)?.toISOString()).toBe(
      '2027-01-10T12:00:00.000Z',
    );
  });

  it('uses the local month, not the UTC month, near midnight', () => {
    // 31/out 22:00 em SP = 1/nov 01:00 UTC — ainda é outubro para o usuário
    const agora = new Date('2026-11-01T01:00:00Z');
    expect(
      calcularProximoDisparo(
        mensal(31, { horario: '23:00' }),
        agora,
        TZ,
      )?.toISOString(),
    ).toBe('2026-11-01T02:00:00.000Z');
  });
});

describe('calcularProximoDisparo — UNICO', () => {
  const unico = (data: string, extra: Partial<ReminderScheduleInput> = {}) =>
    ({
      recorrencia: 'UNICO',
      diaDoMes: null,
      dataUnica: new Date(data),
      horario: '09:00',
      diasAntecedencia: 0,
      ...extra,
    }) satisfies ReminderScheduleInput;

  it('fires on the given date', () => {
    const agora = new Date('2026-10-11T15:00:00Z');
    expect(
      calcularProximoDisparo(unico('2026-12-05'), agora, TZ)?.toISOString(),
    ).toBe('2026-12-05T12:00:00.000Z');
  });

  it('returns null when the date already passed', () => {
    const agora = new Date('2026-10-11T15:00:00Z');
    expect(calcularProximoDisparo(unico('2026-10-01'), agora, TZ)).toBeNull();
  });

  it('applies diasAntecedencia', () => {
    const agora = new Date('2026-10-11T15:00:00Z');
    expect(
      calcularProximoDisparo(
        unico('2026-12-05', { diasAntecedencia: 1 }),
        agora,
        TZ,
      )?.toISOString(),
    ).toBe('2026-12-04T12:00:00.000Z');
  });
});

describe('dataDoEvento', () => {
  it('adds diasAntecedencia back to the local fire date', () => {
    const disparo = new Date('2026-10-30T12:00:00Z');
    expect(dataDoEvento(disparo, 3, TZ).toISOString()).toBe(
      '2026-11-02T00:00:00.000Z',
    );
  });
});
