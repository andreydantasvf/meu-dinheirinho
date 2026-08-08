import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';

export const categoryRoutes = Router();

categoryRoutes.get('/', categoryController.list);
categoryRoutes.get('/:id', categoryController.get);
categoryRoutes.post('/', categoryController.create);
categoryRoutes.put('/:id', categoryController.update);
categoryRoutes.delete('/:id', categoryController.remove);
