import { Router } from 'express';
import { reminderController } from '../controllers/reminder.controller';

export const reminderRoutes = Router();

reminderRoutes.get('/', reminderController.list);
reminderRoutes.get('/:id', reminderController.get);
reminderRoutes.post('/', reminderController.create);
reminderRoutes.put('/:id', reminderController.update);
reminderRoutes.delete('/:id', reminderController.remove);
reminderRoutes.post('/:id/test', reminderController.test);
