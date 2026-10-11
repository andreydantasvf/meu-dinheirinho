import type { Request, Response } from 'express';
import { reminderService } from '../services/reminder.service';
import {
  createReminderSchema,
  updateReminderSchema,
} from '../validators/reminder.schema';

type IdParams = { id: string };

export const reminderController = {
  async list(_req: Request, res: Response) {
    const reminders = await reminderService.list();
    res.json(reminders);
  },

  async get(req: Request<IdParams>, res: Response) {
    const reminder = await reminderService.get(req.params.id);
    res.json(reminder);
  },

  async create(req: Request, res: Response) {
    const data = createReminderSchema.parse(req.body);
    const reminder = await reminderService.create(data);
    res.status(201).json(reminder);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateReminderSchema.parse(req.body);
    const reminder = await reminderService.update(req.params.id, data);
    res.json(reminder);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await reminderService.remove(req.params.id);
    res.status(204).send();
  },

  async test(req: Request<IdParams>, res: Response) {
    const canais = await reminderService.test(req.params.id);
    res.json({ canais });
  },
};
