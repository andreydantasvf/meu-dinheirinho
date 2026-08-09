import { Router } from 'express';
import { accountController } from '../controllers/account.controller';

export const accountRoutes = Router();

accountRoutes.get('/', accountController.list);
accountRoutes.get('/:id', accountController.get);
accountRoutes.post('/', accountController.create);
accountRoutes.put('/:id', accountController.update);
accountRoutes.delete('/:id', accountController.remove);
