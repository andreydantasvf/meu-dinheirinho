import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';

export const purchaseRoutes = Router();

purchaseRoutes.get('/', purchaseController.list);
purchaseRoutes.get('/:id', purchaseController.get);
purchaseRoutes.post('/', purchaseController.create);
purchaseRoutes.delete('/:id', purchaseController.remove);
