import { useState } from 'react';
import { useCreateFixedExpense } from '@/hooks/use-fixed-expenses';
import { useCreateReminder, useReminders } from '@/hooks/use-reminders';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import type {
  Control,
  FieldErrors,
  Path,
  UseFormRegister,
  UseFormRegisterReturn,
  UseFormSetValue,
} from 'react-hook-form';
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
import { todayLocalIso } from '@/lib/date';
import { useCloseModal } from '@/hooks/use-close-modal';
import { ApiError } from '@/lib/api';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/hooks/use-transactions';
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from '@/types/entities';

const commonFieldsSchema = {
  valor: z
    .string()
    .refine((value) => Number(value) > 0, 'Informe um valor maior que zero'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
  descricao: z.string().trim().min(1, 'Informe uma descrição'),
  data: z.string().min(1, 'Selecione uma data'),
};

const despesaSchema = z.object({
  ...commonFieldsSchema,
  isFixedExpense: z.boolean().optional(),
  lembrarTodoMes: z.boolean().optional(),
});

const receitaSchema = z.object({
  ...commonFieldsSchema,
  lembrarTodoMes: z.boolean().optional(),
});

type CommonFormValues = z.infer<z.ZodObject<typeof commonFieldsSchema>>;
type DespesaFormValues = z.infer<typeof despesaSchema>;
type ReceitaFormValues = z.infer<typeof receitaSchema>;

// Funções (e não constantes de módulo): a data padrão é "hoje" no momento em que
// o formulário abre, não quando o módulo carregou.
function emptyDespesaValues(): DespesaFormValues {
  return {
    valor: '0.00',
    categoryId: '',
    accountId: '',
    descricao: '',
    data: todayLocalIso(),
    isFixedExpense: false,
    lembrarTodoMes: false,
  };
}

function emptyReceitaValues(): ReceitaFormValues {
  return {
    valor: '0.00',
    categoryId: '',
    accountId: '',
    descricao: '',
    data: todayLocalIso(),
    lembrarTodoMes: false,
  };
}

function toCommonValues(transaction: Transaction): CommonFormValues {
  return {
    valor: transaction.valor,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    descricao: transaction.descricao,
    data: transaction.data,
  };
}

// Only prefills from `transaction` when it actually matches this form's type —
// switching type on an existing transaction starts that type's fields fresh
// instead of carrying over a category/account that belongs to the other type.
function despesaDefaults(
  transaction: Transaction | undefined,
): DespesaFormValues {
  if (transaction?.tipo === 'DESPESA') {
    return {
      ...toCommonValues(transaction),
      isFixedExpense: false,
      lembrarTodoMes: false,
    };
  }
  return emptyDespesaValues();
}

function receitaDefaults(
  transaction: Transaction | undefined,
): ReceitaFormValues {
  if (transaction?.tipo === 'RECEITA') {
    return { ...toCommonValues(transaction), lembrarTodoMes: false };
  }
  return emptyReceitaValues();
}

// Lembrete é um módulo à parte (não mexe no saldo) — o toggle só cria um Reminder
// mensal pré-preenchido depois que a transação foi salva.
function useCreateMonthlyReminder() {
  const createReminder = useCreateReminder();
  return async (
    values: CommonFormValues,
    tipo: TransactionType,
    fixedExpenseId?: string,
  ) => {
    try {
      await createReminder.mutateAsync({
        titulo: values.descricao,
        tipo: tipo === 'RECEITA' ? 'ENTRADA' : 'SAIDA',
        valor: values.valor,
        recorrencia: 'MENSAL',
        diaDoMes: new Date(values.data).getDate(),
        fixedExpenseId: fixedExpenseId ?? null,
      });
      toast.success('Lembrete mensal criado');
    } catch (error) {
      toast.warning('Transação salva, mas o lembrete não foi criado', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    }
  };
}

// Não existe FK transação → lembrete, então ao editar procura um lembrete que
// "pertença" à transação: mesmo gasto fixo, ou mesmo título/tipo/dia (o que o
// toggle teria criado). Evita oferecer criar um lembrete duplicado.
function useExistingReminder(transaction: Transaction | undefined) {
  const { data: reminders } = useReminders();
  if (!transaction || !reminders) return undefined;
  const tipo = transaction.tipo === 'RECEITA' ? 'ENTRADA' : 'SAIDA';
  const dia = new Date(transaction.data).getDate();
  return reminders.find(
    (r) =>
      (transaction.fixedExpenseId &&
        r.fixedExpenseId === transaction.fixedExpenseId) ||
      (r.recorrencia === 'MENSAL' &&
        r.tipo === tipo &&
        r.titulo === transaction.descricao &&
        r.diaDoMes === dia),
  );
}

function RememberMonthlyToggle({
  inputProps,
  transaction,
}: {
  inputProps: UseFormRegisterReturn;
  transaction?: Transaction;
}) {
  const existing = useExistingReminder(transaction);

  if (existing) {
    return (
      <Link
        to="/lembretes"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 transition-colors"
      >
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-bold text-foreground">
            Lembrete mensal ativo
          </span>
          <span className="text-xs text-muted-foreground">
            {existing.ativo
              ? `Todo dia ${existing.diaDoMes ?? '—'} às ${existing.horario}`
              : 'Pausado'}{' '}
            · gerenciar em Lembretes
          </span>
        </div>
      </Link>
    );
  }

  return (
    <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 cursor-pointer transition-colors">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-bold text-foreground">
          Me lembrar todo mês
        </span>
        <span className="text-xs text-muted-foreground">
          Notifica no celular e no Discord neste mesmo dia
        </span>
      </div>
      <input
        type="checkbox"
        className="size-5 rounded border-border text-primary focus:ring-primary/20 bg-background"
        {...inputProps}
      />
    </label>
  );
}

function TransactionCommonFields<T extends CommonFormValues>({
  control,
  register,
  errors,
  setValue,
  categories,
  categoryTipo,
  accounts,
  selectedCategoryId,
  selectedAccountId,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  setValue: UseFormSetValue<T>;
  categories: Category[] | undefined;
  categoryTipo: TransactionType;
  accounts: Account[] | undefined;
  selectedCategoryId: string;
  selectedAccountId: string;
}) {
  const filteredCategories =
    categories?.filter((category) => category.tipo === categoryTipo) ?? [];

  return (
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
                onClick={() =>
                  setValue('categoryId' as Path<T>, cat.id as never, {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
                  isSelected
                    ? 'bg-primary/15 border border-primary text-primary shadow-[0_0_12px_rgba(0,200,255,0.2)]'
                    : 'bg-foreground/5 border border-border text-muted-foreground hover:bg-foreground/10',
                )}
              >
                <CategoryIcon
                  name={cat.nome}
                  icon={cat.icone}
                  color={cat.cor}
                  size={14}
                  className="size-5 rounded-lg"
                />
                <span>{cat.nome}</span>
              </button>
            );
          })}
        </div>

        {filteredCategories.length === 0 && (
          <ControlledSelect
            control={control}
            name={'categoryId' as Path<T>}
            placeholder="Selecione uma categoria"
            options={[]}
          />
        )}
        <FieldError errors={[errors.categoryId as { message?: string }]} />
      </Field>

      {/* Account Selector */}
      <Field className="flex flex-col gap-2">
        <FieldLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Conta
        </FieldLabel>
        <ControlledSelect
          control={control}
          name={'accountId' as Path<T>}
          placeholder="Selecione a conta de origem"
          options={(accounts ?? [])
            // Cartão não é conta de origem de um lançamento novo, mas uma
            // assinatura/parcela já lançada num cartão precisa mostrá-lo.
            .filter(
              (a) => a.tipo !== 'CARTAO_CREDITO' || a.id === selectedAccountId,
            )
            .map((account) => ({
              value: account.id,
              label: account.nome,
            }))}
        />
        <FieldError errors={[errors.accountId as { message?: string }]} />
      </Field>

      {/* Description Input */}
      <Field className="flex flex-col gap-2">
        <FieldLabel
          htmlFor="descricao"
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Descrição
        </FieldLabel>
        <Input
          id="descricao"
          placeholder="Ex: Mercado Bom Preço"
          className="h-12 rounded-xl border-border bg-card px-4 text-base md:text-sm text-foreground placeholder:text-muted-foreground"
          {...register('descricao' as Path<T>)}
        />
        <FieldError errors={[errors.descricao as { message?: string }]} />
      </Field>

      {/* Date Picker */}
      <Field className="flex flex-col gap-2">
        <FieldLabel
          htmlFor="data"
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Data
        </FieldLabel>
        <ControlledDatePicker control={control} name={'data' as Path<T>} />
        <FieldError errors={[errors.data as { message?: string }]} />
      </Field>
    </FieldGroup>
  );
}

function DespesaForm({
  transaction,
  isEditing,
  id,
  isLocked,
}: {
  transaction: Transaction | undefined;
  isEditing: boolean;
  id: string | undefined;
  isLocked: boolean;
}) {
  const closeModal = useCloseModal();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const createTransaction = useCreateTransaction();
  const createFixedExpense = useCreateFixedExpense();
  const updateTransaction = useUpdateTransaction();
  const createMonthlyReminder = useCreateMonthlyReminder();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DespesaFormValues>({
    resolver: zodResolver(despesaSchema),
    defaultValues: despesaDefaults(transaction),
    // `transaction` can still be undefined on the render that first mounts this
    // form (e.g. React 18 Strict Mode's dev-only double-invoke racing the
    // query). `values` keeps the form in sync once the real data lands,
    // instead of leaving it stuck on the empty defaultValues forever.
    values: transaction ? despesaDefaults(transaction) : undefined,
    // Reabrir uma transação mostra primeiro o cache e depois o refetch chega:
    // sem isso o reset do `values` apagaria o que o usuário já digitou.
    resetOptions: { keepDirtyValues: true },
  });

  const selectedCategoryId = watch('categoryId');
  const selectedAccountId = watch('accountId');

  async function onSubmit(values: DespesaFormValues) {
    try {
      const { isFixedExpense, lembrarTodoMes, ...transactionValues } = values;
      if (isFixedExpense && !isEditing) {
        const fixedExpense = await createFixedExpense.mutateAsync({
          accountId: values.accountId,
          categoryId: values.categoryId,
          valor: values.valor,
          descricao: values.descricao,
          dataInicio: values.data,
        });
        toast.success('Despesa fixa criada com sucesso');
        if (lembrarTodoMes) {
          await createMonthlyReminder(values, 'DESPESA', fixedExpense.id);
        }
      } else if (isEditing && id) {
        await updateTransaction.mutateAsync({
          id,
          tipo: 'DESPESA',
          ...transactionValues,
        });
        toast.success('Transação atualizada com sucesso');
        if (lembrarTodoMes) {
          await createMonthlyReminder(
            values,
            'DESPESA',
            transaction?.fixedExpenseId ?? undefined,
          );
        }
      } else {
        await createTransaction.mutateAsync({
          tipo: 'DESPESA',
          ...transactionValues,
        });
        toast.success('Transação criada com sucesso');
        if (lembrarTodoMes) await createMonthlyReminder(values, 'DESPESA');
      }
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset
        disabled={isLocked}
        className="flex flex-col gap-5 min-w-0 border-none p-0 m-0"
      >
        {/* Hero Money Input */}
        <div className="flex flex-col items-center gap-1.5 py-4">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Valor
          </span>
          <ControlledHeroMoneyInput control={control} name="valor" />
          <FieldError errors={[errors.valor]} />
        </div>

        <TransactionCommonFields
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          categories={categories}
          categoryTipo="DESPESA"
          accounts={accounts}
          selectedCategoryId={selectedCategoryId}
          selectedAccountId={selectedAccountId}
        />

        {!isEditing && (
          <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 cursor-pointer transition-colors">
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-bold text-foreground">
                Despesa fixa (mensal)
              </span>
              <span className="text-xs text-muted-foreground">
                Repete todo mês neste mesmo dia
              </span>
            </div>
            <input
              type="checkbox"
              className="size-5 rounded border-border text-primary focus:ring-primary/20 bg-background"
              {...register('isFixedExpense')}
            />
          </label>
        )}

        <RememberMonthlyToggle
          inputProps={register('lembrarTodoMes')}
          transaction={isEditing ? transaction : undefined}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 h-14 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar transação'}
        </Button>
      </fieldset>
    </form>
  );
}

function ReceitaForm({
  transaction,
  isEditing,
  id,
  isLocked,
}: {
  transaction: Transaction | undefined;
  isEditing: boolean;
  id: string | undefined;
  isLocked: boolean;
}) {
  const closeModal = useCloseModal();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const createMonthlyReminder = useCreateMonthlyReminder();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReceitaFormValues>({
    resolver: zodResolver(receitaSchema),
    defaultValues: receitaDefaults(transaction),
    // See the matching comment in DespesaForm: keeps the form synced if
    // `transaction` is still undefined on the render that mounts this form.
    values: transaction ? receitaDefaults(transaction) : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  const selectedCategoryId = watch('categoryId');
  const selectedAccountId = watch('accountId');

  async function onSubmit(values: ReceitaFormValues) {
    try {
      const { lembrarTodoMes, ...transactionValues } = values;
      if (isEditing && id) {
        await updateTransaction.mutateAsync({
          id,
          tipo: 'RECEITA',
          ...transactionValues,
        });
        toast.success('Transação atualizada com sucesso');
        if (lembrarTodoMes) await createMonthlyReminder(values, 'RECEITA');
      } else {
        await createTransaction.mutateAsync({
          tipo: 'RECEITA',
          ...transactionValues,
        });
        toast.success('Transação criada com sucesso');
        if (lembrarTodoMes) await createMonthlyReminder(values, 'RECEITA');
      }
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset
        disabled={isLocked}
        className="flex flex-col gap-5 min-w-0 border-none p-0 m-0"
      >
        {/* Hero Money Input */}
        <div className="flex flex-col items-center gap-1.5 py-4">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Valor
          </span>
          <ControlledHeroMoneyInput control={control} name="valor" />
          <FieldError errors={[errors.valor]} />
        </div>

        <TransactionCommonFields
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          categories={categories}
          categoryTipo="RECEITA"
          accounts={accounts}
          selectedCategoryId={selectedCategoryId}
          selectedAccountId={selectedAccountId}
        />

        <RememberMonthlyToggle
          inputProps={register('lembrarTodoMes')}
          transaction={isEditing ? transaction : undefined}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 h-14 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar transação'}
        </Button>
      </fieldset>
    </form>
  );
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
  const [tipo, setTipo] = useState<TransactionType>(
    transaction?.tipo ?? 'DESPESA',
  );
  const isLocked = Boolean(transaction?.purchaseId);

  return (
    <ModalRoute title={isEditing ? 'Editar transação' : 'Nova transação'}>
      {isLocked && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
          Esta transação faz parte de uma compra parcelada e não pode ser
          editada diretamente.
        </div>
      )}

      <div className="mb-5">
        <TransactionTypeToggle
          value={tipo}
          onChange={setTipo}
          disabled={isLocked}
        />
      </div>

      {tipo === 'DESPESA' ? (
        <DespesaForm
          key="despesa"
          transaction={transaction}
          isEditing={isEditing}
          id={id}
          isLocked={isLocked}
        />
      ) : (
        <ReceitaForm
          key="receita"
          transaction={transaction}
          isEditing={isEditing}
          id={id}
          isLocked={isLocked}
        />
      )}
    </ModalRoute>
  );
}
