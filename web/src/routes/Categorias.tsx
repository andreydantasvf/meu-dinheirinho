import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryFormDialog } from '@/components/category-form-dialog';
import { useCategories, useDeleteCategory } from '@/hooks/use-categories';
import { ApiError } from '@/lib/api';
import type { Category } from '@/types/entities';

const groupLabels: Record<Category['tipo'], string> = {
  DESPESA: 'Despesas',
  RECEITA: 'Receitas',
};

export default function Categorias() {
  const { data: categories, isLoading, isError } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteCategory.mutateAsync(deleting.id);
      toast.success('Categoria excluída');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  const groups = (['DESPESA', 'RECEITA'] as const).map((tipo) => ({
    tipo,
    items: categories?.filter((category) => category.tipo === tipo) ?? [],
  }));

  return (
    <div className="p-4 pb-24">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as categorias.
        </p>
      )}

      {categories && categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma categoria cadastrada ainda.
        </p>
      )}

      {categories &&
        categories.length > 0 &&
        groups.map(
          (group) =>
            group.items.length > 0 && (
              <section key={group.tipo} className="mb-6">
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {groupLabels[group.tipo]}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ backgroundColor: category.cor ?? undefined }}
                      >
                        {category.icone}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {category.nome}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar categoria"
                        onClick={() => openEdit(category)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir categoria"
                        onClick={() => setDeleting(category)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}

      <Button
        onClick={openCreate}
        size="icon-lg"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] rounded-full shadow-lg"
        aria-label="Nova categoria"
      >
        <Plus />
      </Button>

      <CategoryFormDialog
        category={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{deleting?.nome}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
