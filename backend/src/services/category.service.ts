import { categoryRepository } from '../repositories/category.repository';
import { AppError } from '../types/errors';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.schema';

export const categoryService = {
  list() {
    return categoryRepository.findAll();
  },

  async get(id: string) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError('Categoria não encontrada', 404);
    return category;
  },

  create(data: CreateCategoryInput) {
    return categoryRepository.create(data);
  },

  async update(id: string, data: UpdateCategoryInput) {
    await this.get(id);
    return categoryRepository.update(id, data);
  },

  async remove(id: string) {
    await this.get(id);
    return categoryRepository.remove(id);
  },
};
