import { useState } from 'react';
import { IconPencil, IconPlus, IconTrash, IconTag } from '@tabler/icons-react';
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
import { CategoryIcon } from '@/components/category-icon';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/entities';

type TabType = 'DESPESA' | 'RECEITA';

export default function Categorias() {
  const { data: categories, isLoading, isError } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [activeTab, setActiveTab] = useState<TabType>('DESPESA');
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
      toast.success('Categoria excluída com sucesso');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  const currentCategories =
    categories?.filter((category) => category.tipo === activeTab) ?? [];

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Top Bar with Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Categorias</h2>
        <Button
          onClick={openCreate}
          size="sm"
          className="gap-1.5 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)] hover:bg-primary/90"
        >
          <IconPlus size={16} stroke={2.5} /> Nova
        </Button>
      </div>

      {/* Segmented Type Switcher */}
      <div className="flex items-center gap-2 rounded-2xl bg-card p-1.5 border border-border">
        <button
          type="button"
          onClick={() => setActiveTab('DESPESA')}
          className={cn(
            'flex-1 rounded-xl py-2 text-xs font-bold transition-all text-center',
            activeTab === 'DESPESA'
              ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Despesas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RECEITA')}
          className={cn(
            'flex-1 rounded-xl py-2 text-xs font-bold transition-all text-center',
            activeTab === 'RECEITA'
              ? 'bg-success text-success-foreground shadow-[0_0_16px_rgba(34,211,160,0.3)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Receitas
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full rounded-2xl bg-foreground/5" />
          <Skeleton className="h-14 w-full rounded-2xl bg-foreground/5" />
          <Skeleton className="h-14 w-full rounded-2xl bg-foreground/5" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm font-medium text-destructive">
          Não foi possível carregar as categorias.
        </p>
      )}

      {categories && currentCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
          <IconTag size={36} className="text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Nenhuma categoria de {activeTab === 'DESPESA' ? 'despesa' : 'receita'} cadastrada.
          </p>
          <Button
            onClick={openCreate}
            className="rounded-xl bg-primary font-bold text-primary-foreground"
          >
            Criar categoria
          </Button>
        </div>
      )}

      {/* Category List */}
      {currentCategories.length > 0 && (
        <div className="flex flex-col rounded-3xl border border-border bg-card overflow-hidden">
          {currentCategories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between border-b border-border p-4 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <CategoryIcon
                  name={category.nome}
                  icon={category.icone}
                  color={category.cor}
                  size={20}
                  className="size-11 rounded-2xl"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">
                    {category.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.tipo === 'DESPESA' ? 'Despesa' : 'Receita'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar categoria"
                  onClick={() => openEdit(category)}
                  className="size-8 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                >
                  <IconPencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir categoria"
                  onClick={() => setDeleting(category)}
                  className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        category={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{deleting?.nome}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
