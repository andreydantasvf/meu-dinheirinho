import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';

export const transactionRoutes = Router();

transactionRoutes.get('/', transactionController.list);
transactionRoutes.get('/:id', transactionController.get);
transactionRoutes.post('/', transactionController.create);
transactionRoutes.put('/:id', transactionController.update);
transactionRoutes.delete('/:id', transactionController.remove);
