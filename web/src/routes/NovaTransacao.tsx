import { useNavigate, useParams } from 'react-router-dom';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ModalRoute } from '../components/ModalRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoneyInput } from '@/components/money-input';
import { DatePickerField } from '@/components/date-picker-field';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import {
  useCreateTransaction,
  useTransaction,
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
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const emptyValues: TransactionFormValues = {
  tipo: 'DESPESA',
  valor: '0.00',
  categoryId: '',
  accountId: '',
  descricao: '',
  data: new Date().toISOString(),
};

function toFormValues(transaction: Transaction): TransactionFormValues {
  return {
    tipo: transaction.tipo,
    valor: transaction.valor,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    descricao: transaction.descricao,
    data: transaction.data,
  };
}

export default function NovaTransacao() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: transaction, isLoading: isLoadingTransaction } =
    useTransaction(id);

  if (isEditing && isLoadingTransaction) {
    return (
      <ModalRoute title="Transação">
        <p className="py-8 text-center text-sm font-medium text-muted-foreground">Carregando...</p>
      </ModalRoute>
    );
  }

  return (
    <TransactionForm transaction={transaction} isEditing={isEditing} id={id} />
  );
}

function TransactionForm({
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
      if (isEditing && id) {
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
          <TipoToggle control={control} />

          {/* Hero Money Input */}
          <div className="flex flex-col items-center gap-1.5 py-4">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Valor
            </span>
            <MoneyField control={control} />
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
                <SelectField
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
              <SelectField
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
              <DateField control={control} />
              <FieldError errors={[errors.data]} />
            </Field>
          </FieldGroup>

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

function TipoToggle({
  control,
}: {
  control: ReturnType<typeof useForm<TransactionFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'tipo' });

  return (
    <div className="flex rounded-2xl bg-foreground/5 p-1 border border-border">
      <button
        type="button"
        onClick={() => field.onChange('DESPESA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center',
          field.value === 'DESPESA'
            ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Saída (Despesa)
      </button>
      <button
        type="button"
        onClick={() => field.onChange('RECEITA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center',
          field.value === 'RECEITA'
            ? 'bg-success text-success-foreground shadow-[0_0_16px_rgba(34,211,160,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Entrada (Receita)
      </button>
    </div>
  );
}

function MoneyField({
  control,
}: {
  control: ReturnType<typeof useForm<TransactionFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'valor' });
  return (
    <div className="flex items-baseline justify-center gap-1 max-w-[90%]">
      <span className="text-2xl font-bold text-muted-foreground">R$</span>
      <MoneyInput
        id="valor"
        value={field.value}
        onChange={field.onChange}
        className="h-auto border-none bg-transparent p-0 text-primary text-4xl font-extrabold tracking-tight tabular-nums focus-visible:ring-0 w-auto text-center"
      />
    </div>
  );
}

function DateField({
  control,
}: {
  control: ReturnType<typeof useForm<TransactionFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'data' });
  return (
    <DatePickerField id="data" value={field.value} onChange={field.onChange} />
  );
}

function SelectField({
  control,
  name,
  placeholder,
  options,
}: {
  control: ReturnType<typeof useForm<TransactionFormValues>>['control'];
  name: 'categoryId' | 'accountId';
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  const { field } = useController({ control, name });
  const selectedLabel = options.find(
    (option) => option.value === field.value,
  )?.label;
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger id={name} className="h-12 w-full rounded-xl border-border bg-card text-sm text-foreground">
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
