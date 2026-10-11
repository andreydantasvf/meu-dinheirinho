import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { montarMensagem } from './reminder-message';

const TZ = 'America/Sao_Paulo';

describe('montarMensagem', () => {
  it('builds an ENTRADA message for today with formatted valor', () => {
    const msg = montarMensagem(
      {
        titulo: 'Freela da Nara',
        tipo: 'ENTRADA',
        valor: new Prisma.Decimal('1500.5'),
        diasAntecedencia: 0,
      },
      new Date('2026-10-25T12:00:00Z'),
      new Date('2026-10-25T12:01:00Z'),
      TZ,
    );

    expect(msg.title).toBe('Recebimento: Freela da Nara');
    expect(msg.body).toBe('R$ 1.500,50 · hoje (25/10)');
    expect(msg.path).toBe('/lembretes');
  });

  it('omits valor and shows the event date when firing in advance', () => {
    const msg = montarMensagem(
      { titulo: 'Geladeira', tipo: 'SAIDA', valor: null, diasAntecedencia: 3 },
      new Date('2026-10-07T12:00:00Z'),
      new Date('2026-10-07T12:01:00Z'),
      TZ,
    );

    expect(msg.title).toBe('Pagamento: Geladeira');
    expect(msg.body).toBe('em 3 dias (10/10)');
  });

  it('says "amanhã" for one day in advance', () => {
    const msg = montarMensagem(
      { titulo: 'Aluguel', tipo: 'SAIDA', valor: null, diasAntecedencia: 1 },
      new Date('2026-10-09T12:00:00Z'),
      new Date('2026-10-09T12:01:00Z'),
      TZ,
    );

    expect(msg.body).toBe('amanhã (10/10)');
  });

  it('says "venceu" when dispatched late (after downtime)', () => {
    const msg = montarMensagem(
      { titulo: 'Geladeira', tipo: 'SAIDA', valor: null, diasAntecedencia: 0 },
      new Date('2026-08-10T12:00:00Z'),
      new Date('2026-10-11T15:00:00Z'),
      TZ,
    );

    expect(msg.body).toBe('venceu em 10/08');
  });
});
