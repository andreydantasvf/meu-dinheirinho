import { useNavigate } from 'react-router-dom';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { IconMinus, IconPlus } from '@tabler/icons-react';
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
import { ApiError } from '@/lib/api';
import { apiStringToCents, centsToApiString, formatMoney } from '@/lib/money';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import { useCreatePurchase } from '@/hooks/use-purchases';

const purchaseSchema = z.object({
  descricao: z.string().trim().min(1, 'Informe uma descrição'),
  valorTotal: z
    .string()
    .refine((value) => Number(value) > 0, 'Informe um valor maior que zero'),
  numeroParcelas: z.number().int().min(1, 'Informe ao menos 1 parcela'),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  accountId: z.string().min(1, 'Selecione uma conta'),
  dataCompra: z.string().min(1, 'Selecione uma data'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

const defaultValues: PurchaseFormValues = {
  descricao: '',
  valorTotal: '0.00',
  numeroParcelas: 2,
  categoryId: '',
  accountId: '',
  dataCompra: new Date().toISOString(),
};

export default function NovaCompraParcelada() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const createPurchase = useCreatePurchase();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues,
  });

  const valorTotal = watch('valorTotal');
  const numeroParcelas = watch('numeroParcelas');
  const despesaCategories =
    categories?.filter((category) => category.tipo === 'DESPESA') ?? [];

  const preview = buildInstallmentPreview(valorTotal, numeroParcelas);

  async function onSubmit(values: PurchaseFormValues) {
    try {
      await createPurchase.mutateAsync(values);
      toast.success('Compra parcelada criada com sucesso');
      navigate(-1);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  return (
    <ModalRoute title="Compra parcelada">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Hero Money Input */}
        <div className="flex flex-col items-center gap-1.5 py-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Valor Total
          </span>
          <MoneyField control={control} />
          <FieldError errors={[errors.valorTotal]} />
        </div>

        {/* Installments Stepper Control */}
        <div className="flex flex-col gap-2">
          <label htmlFor="numeroParcelas" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Número de parcelas
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setValue('numeroParcelas', Math.max(1, numeroParcelas - 1))}
              className="flex size-12 items-center justify-center rounded-xl bg-card border border-border text-foreground hover:bg-foreground/10 active:scale-95 transition-all"
            >
              <IconMinus size={20} stroke={2.5} />
            </button>

            <div className="flex flex-1 h-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/40 text-xl font-extrabold text-primary">
              {numeroParcelas}×
            </div>

            <button
              type="button"
              onClick={() => setValue('numeroParcelas', numeroParcelas + 1)}
              className="flex size-12 items-center justify-center rounded-xl bg-card border border-border text-foreground hover:bg-foreground/10 active:scale-95 transition-all"
            >
              <IconPlus size={20} stroke={2.5} />
            </button>
          </div>
          <FieldError errors={[errors.numeroParcelas]} />
        </div>

        {/* Installments Live Preview Card */}
        {preview && (
          <div className="flex flex-col gap-2 rounded-2xl bg-primary/10 border border-primary/30 p-4 text-foreground">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                Vai gerar
              </span>
              <span className="text-base font-extrabold text-foreground tabular-nums">
                {preview.numeroParcelas} × {formatMoney(preview.installmentDisplay)}
              </span>
            </div>
            {preview.lastDiffers && (
              <p className="text-xs text-muted-foreground">
                * Última parcela com ajuste de centavos: {formatMoney(preview.lastDisplay)}
              </p>
            )}
          </div>
        )}

        <FieldGroup className="flex flex-col gap-4">
          {/* Description Input */}
          <Field className="flex flex-col gap-2">
            <FieldLabel htmlFor="descricao" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Descrição do produto/serviço
            </FieldLabel>
            <Input
              id="descricao"
              placeholder="Ex: Geladeira Frost Free"
              className="h-12 rounded-xl border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground"
              {...register('descricao')}
            />
            <FieldError errors={[errors.descricao]} />
          </Field>

          {/* Account Selector */}
          <Field className="flex flex-col gap-2">
            <FieldLabel htmlFor="accountId" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Cartão de crédito
            </FieldLabel>
            <SelectField
              control={control}
              name="accountId"
              placeholder="Selecione o cartão"
              options={(accounts ?? []).map((account) => ({
                value: account.id,
                label: account.nome,
              }))}
            />
            <FieldError errors={[errors.accountId]} />
          </Field>

          {/* Category Selector */}
          <Field className="flex flex-col gap-2">
            <FieldLabel htmlFor="categoryId" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Categoria
            </FieldLabel>
            <SelectField
              control={control}
              name="categoryId"
              placeholder="Selecione uma categoria"
              options={despesaCategories.map((category) => ({
                value: category.id,
                label: category.nome,
              }))}
            />
            <FieldError errors={[errors.categoryId]} />
          </Field>

          {/* Purchase Date */}
          <Field className="flex flex-col gap-2">
            <FieldLabel htmlFor="dataCompra" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Data da 1ª parcela
            </FieldLabel>
            <DateField control={control} />
            <FieldError errors={[errors.dataCompra]} />
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 h-14 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          {isSubmitting
            ? 'Criando parcelas...'
            : `Criar ${numeroParcelas} lançamentos`}
        </Button>
      </form>
    </ModalRoute>
  );
}

function buildInstallmentPreview(valorTotal: string, numeroParcelas: number) {
  const totalCents = apiStringToCents(valorTotal);
  if (
    !Number.isInteger(numeroParcelas) ||
    numeroParcelas < 1 ||
    totalCents <= 0
  )
    return null;

  const baseCents = Math.floor(totalCents / numeroParcelas);
  const lastCents = totalCents - baseCents * (numeroParcelas - 1);

  return {
    numeroParcelas,
    installmentDisplay: centsToApiString(baseCents),
    lastDisplay: centsToApiString(lastCents),
    lastDiffers: lastCents !== baseCents,
  };
}

function MoneyField({
  control,
}: {
  control: ReturnType<typeof useForm<PurchaseFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'valorTotal' });
  return (
    <div className="flex items-baseline justify-center gap-1">
      <span className="text-2xl font-bold text-muted-foreground">R$</span>
      <MoneyInput
        id="valorTotal"
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
  control: ReturnType<typeof useForm<PurchaseFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'dataCompra' });
  return (
    <DatePickerField
      id="dataCompra"
      value={field.value}
      onChange={field.onChange}
    />
  );
}

function SelectField({
  control,
  name,
  placeholder,
  options,
}: {
  control: ReturnType<typeof useForm<PurchaseFormValues>>['control'];
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
