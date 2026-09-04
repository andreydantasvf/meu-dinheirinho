import { useCreateFixedExpense } from '@/hooks/use-fixed-expenses';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ModalRoute } from './ModalRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { CategoryIcon } from '@/components/category-icon';
import { TransactionTypeToggle } from './transaction-type-toggle';
import {
  ControlledHeroMoneyInput,
  ControlledDatePicker,
  ControlledSelect,
} from './controlled-fields';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/hooks/use-transactions';
import type { Transaction } from '@/types/entities';

const transactionSchema = z.object({
  tipo: z.enum(['DESPESA', 'RECEITA']),
  valor: z.string().refine((value) => Number(value) > 0, 'Informe um valor maior que zero'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
  descricao: z.string().trim().min(1, 'Informe uma descrição'),
  data: z.string().min(1, 'Selecione uma data'),
  isFixedExpense: z.boolean().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const emptyValues: TransactionFormValues = {
  tipo: 'DESPESA',
  valor: '0.00',
  categoryId: '',
  accountId: '',
  descricao: '',
  data: new Date().toISOString(),
  isFixedExpense: false,
};

function toFormValues(transaction: Transaction): TransactionFormValues {
  return {
    tipo: transaction.tipo,
    valor: transaction.valor,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    descricao: transaction.descricao,
    data: transaction.data,
    isFixedExpense: false,
  };
}

export function TransactionForm({
  transaction,
  isEditing,
  id,
}: {
  transaction: Transaction | undefined;
  isEditing: boolean;
  id: string | undefined;
}) {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const createTransaction = useCreateTransaction();
  const createFixedExpense = useCreateFixedExpense();
  const updateTransaction = useUpdateTransaction();

  const isLocked = Boolean(transaction?.purchaseId);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction ? toFormValues(transaction) : emptyValues,
  });

  const tipo = watch('tipo');
  const selectedCategoryId = watch('categoryId');

  async function onSubmit(values: TransactionFormValues) {
    try {
      if (values.isFixedExpense && !isEditing) {
        await createFixedExpense.mutateAsync({
          accountId: values.accountId,
          categoryId: values.categoryId,
          valor: values.valor,
          descricao: values.descricao,
          dataInicio: values.data,
        });
        toast.success('Despesa fixa criada com sucesso');
      } else if (isEditing && id) {
        await updateTransaction.mutateAsync({ id, ...values });
        toast.success('Transação atualizada com sucesso');
      } else {
        await createTransaction.mutateAsync(values);
        toast.success('Transação criada com sucesso');
      }
      navigate(-1);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  const filteredCategories =
    categories?.filter((category) => category.tipo === tipo) ?? [];

  return (
    <ModalRoute title={isEditing ? 'Editar transação' : 'Nova transação'}>
      {isLocked && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
          Esta transação faz parte de uma compra parcelada e não pode ser editada diretamente.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <fieldset disabled={isLocked} className="contents">
          {/* Segmented Type Toggle */}
          <TransactionTypeToggle control={control} name="tipo" />

          {/* Hero Money Input */}
          <div className="flex flex-col items-center gap-1.5 py-4">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Valor
            </span>
            <ControlledHeroMoneyInput control={control} name="valor" />
            <FieldError errors={[errors.valor]} />
          </div>

          <FieldGroup className="flex flex-col gap-4">
            {/* Category Quick Pills */}
            <Field className="flex flex-col gap-2">
              <FieldLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Categoria
              </FieldLabel>

              <div className="flex flex-wrap gap-2">
                {filteredCategories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setValue('categoryId', cat.id, { shouldValidate: true })}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
                        isSelected
                          ? 'bg-primary/15 border border-primary text-primary shadow-[0_0_12px_rgba(0,200,255,0.2)]'
                          : 'bg-foreground/5 border border-border text-muted-foreground hover:bg-foreground/10',
                      )}
                    >
                      <CategoryIcon name={cat.nome} icon={cat.icone} color={cat.cor} size={14} className="size-5 rounded-lg" />
                      <span>{cat.nome}</span>
                    </button>
                  );
                })}
              </div>

              {filteredCategories.length === 0 && (
                <ControlledSelect
                  control={control}
                  name="categoryId"
                  placeholder="Selecione uma categoria"
                  options={filteredCategories.map((c) => ({
                    value: c.id,
                    label: c.nome,
                  }))}
                />
              )}
              <FieldError errors={[errors.categoryId]} />
            </Field>

            {/* Account Selector */}
            <Field className="flex flex-col gap-2">
              <FieldLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Conta
              </FieldLabel>
              <ControlledSelect
                control={control}
                name="accountId"
                placeholder="Selecione a conta de origem"
                options={(accounts ?? []).filter(a => a.tipo !== 'CARTAO_CREDITO').map((account) => ({
                  value: account.id,
                  label: account.nome,
                }))}
              />
              <FieldError errors={[errors.accountId]} />
            </Field>

            {/* Description Input */}
            <Field className="flex flex-col gap-2">
              <FieldLabel htmlFor="descricao" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Descrição
              </FieldLabel>
              <Input
                id="descricao"
                placeholder="Ex: Mercado Bom Preço"
                className="h-12 rounded-xl border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground"
                {...register('descricao')}
              />
              <FieldError errors={[errors.descricao]} />
            </Field>

            {/* Date Picker */}
            <Field className="flex flex-col gap-2">
              <FieldLabel htmlFor="data" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Data
              </FieldLabel>
              <ControlledDatePicker control={control} name="data" />
              <FieldError errors={[errors.data]} />
            </Field>
          </FieldGroup>

            {!isEditing && tipo === 'DESPESA' && (
              <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 cursor-pointer transition-colors">
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-bold text-foreground">Despesa fixa (mensal)</span>
                  <span className="text-xs text-muted-foreground">Repete todo mês neste mesmo dia</span>
                </div>
                <input
                  type="checkbox"
                  className="size-5 rounded border-border text-primary focus:ring-primary/20 bg-background"
                  {...register('isFixedExpense')}
                />
              </label>
            )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 h-14 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar transação'}
          </Button>
        </fieldset>
      </form>
    </ModalRoute>
  );
}
