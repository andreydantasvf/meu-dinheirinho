import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';

export const purchaseRoutes = Router();

purchaseRoutes.get('/', purchaseController.list);
purchaseRoutes.get('/:id', purchaseController.get);
purchaseRoutes.post('/', purchaseController.create);
purchaseRoutes.put('/:id', purchaseController.update);
purchaseRoutes.delete('/:id', purchaseController.remove);
