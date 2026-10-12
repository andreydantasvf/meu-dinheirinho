import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryRepository } from '../repositories/category.repository';
import { categoryService } from './category.service';

vi.mock('../repositories/category.repository', () => ({
  categoryRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    isInUse: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('categoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remove() throws AppError 404 and does not delete when the category does not exist', async () => {
    vi.mocked(categoryRepository.findById).mockResolvedValue(null);

    await expect(categoryService.remove('missing')).rejects.toMatchObject({
      status: 404,
    });
    expect(categoryRepository.remove).not.toHaveBeenCalled();
  });

  it('remove() throws AppError 409 and does not delete when the category has lançamentos', async () => {
    vi.mocked(categoryRepository.findById).mockResolvedValue({
      id: '1',
    } as never);
    vi.mocked(categoryRepository.isInUse).mockResolvedValue(true);

    await expect(categoryService.remove('1')).rejects.toMatchObject({
      status: 409,
      message: 'Não é possível excluir uma categoria com lançamentos',
    });
    expect(categoryRepository.remove).not.toHaveBeenCalled();
  });

  it('remove() deletes the category when it is not in use', async () => {
    vi.mocked(categoryRepository.findById).mockResolvedValue({
      id: '1',
    } as never);
    vi.mocked(categoryRepository.isInUse).mockResolvedValue(false);

    await categoryService.remove('1');

    expect(categoryRepository.remove).toHaveBeenCalledWith('1');
  });
});
