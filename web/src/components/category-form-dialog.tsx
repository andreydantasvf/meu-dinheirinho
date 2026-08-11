import { useEffect } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import type { Category } from '@/types/entities';

const categorySchema = z.object({
  nome: z.string().trim().min(1, 'Informe um nome'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  icone: z.string().trim().optional(),
  cor: z.string().trim().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const defaultValues: CategoryFormValues = {
  nome: '',
  tipo: 'DESPESA',
  icone: '',
  cor: '#0f766e',
};

export function CategoryFormDialog({
  category,
  open,
  onOpenChange,
}: {
  category?: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = Boolean(category);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      category
        ? {
            nome: category.nome,
            tipo: category.tipo,
            icone: category.icone ?? '',
            cor: category.cor ?? '#0f766e',
          }
        : defaultValues,
    );
  }, [open, category, reset]);

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (isEditing && category) {
        await updateCategory.mutateAsync({ id: category.id, ...values });
        toast.success('Categoria atualizada');
      } else {
        await createCategory.mutateAsync(values);
        toast.success('Categoria criada');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar categoria' : 'Nova categoria'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input
                id="nome"
                placeholder="Alimentação"
                {...register('nome')}
              />
              <FieldError errors={[errors.nome]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
              <SelectField control={control} name="tipo" />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="icone">Ícone (emoji)</FieldLabel>
              <Input
                id="icone"
                placeholder="🍔"
                className="w-20"
                {...register('icone')}
              />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="cor">Cor</FieldLabel>
              <Input
                id="cor"
                type="color"
                className="h-9 w-16 p-1"
                {...register('cor')}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({
  control,
  name,
}: {
  control: ReturnType<typeof useForm<CategoryFormValues>>['control'];
  name: 'tipo';
}) {
  const { field } = useController({ control, name });
  const labels = { DESPESA: 'Despesa', RECEITA: 'Receita' } as const;
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger id={name} className="w-full">
        <SelectValue>{labels[field.value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DESPESA">Despesa</SelectItem>
        <SelectItem value="RECEITA">Receita</SelectItem>
      </SelectContent>
    </Select>
  );
}
