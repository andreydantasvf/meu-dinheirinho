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
import { MoneyInput } from '@/components/money-input';
import { ApiError } from '@/lib/api';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import type { Category } from '@/types/entities';

const categorySchema = z.object({
  nome: z.string().trim().min(1, 'Informe um nome'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  icone: z.string().trim().optional(),
  cor: z.string().trim().optional(),
  metaMensal: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const defaultValues: CategoryFormValues = {
  nome: '',
  tipo: 'DESPESA',
  icone: '',
  cor: '#0f766e',
  metaMensal: '0.00',
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
    watch,
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
            metaMensal: category.metaMensal ?? '0.00',
          }
        : defaultValues,
    );
  }, [open, category, reset]);

  const tipo = watch('tipo');
  const isDespesa = tipo === 'DESPESA';

  async function onSubmit(values: CategoryFormValues) {
    const payload = {
      ...values,
      metaMensal:
        isDespesa && Number(values.metaMensal) > 0
          ? values.metaMensal
          : null,
    };
    try {
      if (isEditing && category) {
        await updateCategory.mutateAsync({ id: category.id, ...payload });
        toast.success('Categoria atualizada');
      } else {
        await createCategory.mutateAsync(payload);
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

            {isDespesa && (
              <Field>
                <FieldLabel htmlFor="metaMensal">
                  Meta mensal (opcional)
                </FieldLabel>
                <MetaMensalField control={control} />
              </Field>
            )}

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

function MetaMensalField({
  control,
}: {
  control: ReturnType<typeof useForm<CategoryFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'metaMensal' });
  return (
    <MoneyInput
      id="metaMensal"
      value={field.value ?? '0.00'}
      onChange={field.onChange}
    />
  );
}
