import { beforeEach, describe, expect, it, vi } from 'vitest';
import { discordNotifier } from '../notifications/discord.notifier';
import { webPushNotifier } from '../notifications/web-push.notifier';
import { reminderRepository } from '../repositories/reminder.repository';
import { AppError } from '../types/errors';
import { reminderService } from './reminder.service';

vi.mock('../repositories/reminder.repository', () => ({
  reminderRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findDue: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markDispatched: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../notifications/discord.notifier', () => ({
  discordNotifier: { name: 'discord', isEnabled: vi.fn(), send: vi.fn() },
}));

vi.mock('../notifications/web-push.notifier', () => ({
  webPushNotifier: { name: 'web-push', isEnabled: vi.fn(), send: vi.fn() },
}));

function reminderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    titulo: 'Freela da Nara',
    tipo: 'ENTRADA' as const,
    valor: null,
    recorrencia: 'MENSAL' as const,
    diaDoMes: 25,
    dataUnica: null,
    horario: '09:00',
    diasAntecedencia: 0,
    ativo: true,
    proximoDisparo: new Date('2026-10-25T12:00:00Z'),
    ultimoDisparo: null,
    fixedExpenseId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('reminderService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.mocked(discordNotifier.isEnabled).mockReturnValue(true);
    vi.mocked(webPushNotifier.isEnabled).mockReturnValue(true);
  });

  describe('create()', () => {
    it('computes proximoDisparo and fills schedule defaults', async () => {
      const agora = new Date('2026-10-11T15:00:00Z');

      await reminderService.create(
        {
          titulo: 'Freela da Nara',
          tipo: 'ENTRADA',
          recorrencia: 'MENSAL',
          diaDoMes: 25,
          dataUnica: new Date('2027-01-01'),
        },
        agora,
      );

      expect(reminderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          horario: '09:00',
          diasAntecedencia: 0,
          dataUnica: null, // descartado: só vale para UNICO
          proximoDisparo: new Date('2026-10-25T12:00:00Z'),
        }),
      );
    });
  });

  describe('update()', () => {
    it('throws 404 when the reminder does not exist', async () => {
      vi.mocked(reminderRepository.findById).mockResolvedValue(null);

      await expect(
        reminderService.update('missing', { ativo: false }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects switching to UNICO without dataUnica', async () => {
      vi.mocked(reminderRepository.findById).mockResolvedValue(
        reminderFixture() as never,
      );

      await expect(
        reminderService.update('r1', { recorrencia: 'UNICO' }),
      ).rejects.toBeInstanceOf(AppError);
      expect(reminderRepository.update).not.toHaveBeenCalled();
    });

    it('recomputes proximoDisparo from the merged record', async () => {
      vi.mocked(reminderRepository.findById).mockResolvedValue(
        reminderFixture() as never,
      );

      await reminderService.update(
        'r1',
        { diaDoMes: 10 },
        new Date('2026-10-11T15:00:00Z'),
      );

      expect(reminderRepository.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          diaDoMes: 10,
          proximoDisparo: new Date('2026-11-10T12:00:00Z'),
        }),
      );
    });
  });

  describe('dispatchDue()', () => {
    it('notifies every enabled channel and advances to the next month', async () => {
      const agora = new Date('2026-10-25T12:02:00Z');
      vi.mocked(reminderRepository.findDue).mockResolvedValue([
        reminderFixture(),
      ] as never);

      const count = await reminderService.dispatchDue(agora);

      expect(count).toBe(1);
      expect(discordNotifier.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Recebimento: Freela da Nara' }),
      );
      expect(webPushNotifier.send).toHaveBeenCalledTimes(1);
      expect(reminderRepository.markDispatched).toHaveBeenCalledWith(
        'r1',
        agora,
        new Date('2026-11-25T12:00:00Z'),
      );
    });

    it('sends a single notification after downtime and skips missed occurrences', async () => {
      // proximoDisparo ficou em agosto; servidor só voltou em outubro
      const agora = new Date('2026-10-11T15:00:00Z');
      vi.mocked(reminderRepository.findDue).mockResolvedValue([
        reminderFixture({ proximoDisparo: new Date('2026-08-25T12:00:00Z') }),
      ] as never);

      await reminderService.dispatchDue(agora);

      expect(discordNotifier.send).toHaveBeenCalledTimes(1);
      expect(reminderRepository.markDispatched).toHaveBeenCalledWith(
        'r1',
        agora,
        new Date('2026-10-25T12:00:00Z'),
      );
    });

    it('still advances the schedule when a channel fails', async () => {
      const agora = new Date('2026-10-25T12:02:00Z');
      vi.mocked(reminderRepository.findDue).mockResolvedValue([
        reminderFixture(),
      ] as never);
      vi.mocked(discordNotifier.send).mockRejectedValue(new Error('boom'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await reminderService.dispatchDue(agora);

      expect(webPushNotifier.send).toHaveBeenCalledTimes(1);
      expect(reminderRepository.markDispatched).toHaveBeenCalledTimes(1);
    });

    it('ends a one-off reminder (proximoDisparo null) after firing', async () => {
      const agora = new Date('2026-12-05T12:01:00Z');
      vi.mocked(reminderRepository.findDue).mockResolvedValue([
        reminderFixture({
          recorrencia: 'UNICO',
          diaDoMes: null,
          dataUnica: new Date('2026-12-05'),
          proximoDisparo: new Date('2026-12-05T12:00:00Z'),
        }),
      ] as never);

      await reminderService.dispatchDue(agora);

      expect(reminderRepository.markDispatched).toHaveBeenCalledWith(
        'r1',
        agora,
        null,
      );
    });
  });

  describe('test()', () => {
    it('reports per-channel status without touching the schedule', async () => {
      vi.mocked(reminderRepository.findById).mockResolvedValue(
        reminderFixture() as never,
      );
      vi.mocked(webPushNotifier.isEnabled).mockReturnValue(false);

      const result = await reminderService.test('r1');

      expect(result).toEqual([
        { canal: 'discord', status: 'enviado' },
        { canal: 'web-push', status: 'desativado' },
      ]);
      expect(reminderRepository.markDispatched).not.toHaveBeenCalled();
    });
  });
});
