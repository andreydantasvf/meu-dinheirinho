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
  valor: z.string().refine((value) => Number(value) > 0, 'Informe um valor'),
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

  // Gate rendering (and therefore the useForm() call below) until the transaction being
  // edited has actually loaded, so the form always mounts with correct defaultValues on its
  // very first render — no reset()/values-sync race against the categoryId/accountId
  // Select controllers, which only register once they mount.
  if (isEditing && isLoadingTransaction) {
    return (
      <ModalRoute title="Transação">
        <p className="text-sm text-muted-foreground">Carregando...</p>
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
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction ? toFormValues(transaction) : emptyValues,
  });

  const tipo = watch('tipo');

  async function onSubmit(values: TransactionFormValues) {
    try {
      if (isEditing && id) {
        await updateTransaction.mutateAsync({ id, ...values });
        toast.success('Transação atualizada');
      } else {
        await createTransaction.mutateAsync(values);
        toast.success('Transação criada');
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
        <p className="mb-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Esta transação faz parte de uma compra parcelada e não pode ser
          editada diretamente.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <fieldset disabled={isLocked} className="contents">
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <TipoToggle control={control} />
            </Field>

            <Field>
              <FieldLabel htmlFor="valor">Valor</FieldLabel>
              <MoneyField control={control} />
              <FieldError errors={[errors.valor]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>
              <SelectField
                control={control}
                name="categoryId"
                placeholder="Selecione uma categoria"
                options={filteredCategories.map((category) => ({
                  value: category.id,
                  label: category.nome,
                }))}
              />
              <FieldError errors={[errors.categoryId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="accountId">Conta</FieldLabel>
              <SelectField
                control={control}
                name="accountId"
                placeholder="Selecione uma conta"
                options={(accounts ?? []).map((account) => ({
                  value: account.id,
                  label: account.nome,
                }))}
              />
              <FieldError errors={[errors.accountId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
              <Input
                id="descricao"
                placeholder="Supermercado"
                {...register('descricao')}
              />
              <FieldError errors={[errors.descricao]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="data">Data</FieldLabel>
              <DateField control={control} />
              <FieldError errors={[errors.data]} />
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={isSubmitting} className="mt-6 w-full">
            Salvar
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
  const options = [
    { value: 'DESPESA', label: 'Despesa' },
    { value: 'RECEITA', label: 'Receita' },
  ] as const;

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => field.onChange(option.value)}
          aria-pressed={field.value === option.value}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            field.value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
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
    <MoneyInput id="valor" value={field.value} onChange={field.onChange} />
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
      <SelectTrigger id={name} className="w-full">
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
