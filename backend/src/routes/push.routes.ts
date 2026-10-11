import { Router } from 'express';
import { pushController } from '../controllers/push.controller';

export const pushRoutes = Router();

pushRoutes.get('/config', pushController.config);
pushRoutes.post('/subscriptions', pushController.subscribe);
pushRoutes.delete('/subscriptions', pushController.unsubscribe);
