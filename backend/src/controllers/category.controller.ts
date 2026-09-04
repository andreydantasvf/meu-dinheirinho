import type { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.schema';

type IdParams = { id: string };

export const categoryController = {
  async list(_req: Request, res: Response) {
    const categories = await categoryService.list();
    res.json(categories);
  },

  async get(req: Request<IdParams>, res: Response) {
    const category = await categoryService.get(req.params.id);
    res.json(category);
  },

  async create(req: Request, res: Response) {
    const data = createCategorySchema.parse(req.body);
    const category = await categoryService.create(data);
    res.status(201).json(category);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateCategorySchema.parse(req.body);
    const category = await categoryService.update(req.params.id, data);
    res.json(category);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await categoryService.remove(req.params.id);
    res.status(204).send();
  },
};
