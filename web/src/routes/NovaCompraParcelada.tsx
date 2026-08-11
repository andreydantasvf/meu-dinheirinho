import { useNavigate } from 'react-router-dom';
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
import { ApiError } from '@/lib/api';
import { apiStringToCents, centsToApiString, formatMoney } from '@/lib/money';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import { useCreatePurchase } from '@/hooks/use-purchases';

const purchaseSchema = z.object({
  descricao: z.string().trim().min(1, 'Informe uma descrição'),
  valorTotal: z
    .string()
    .refine((value) => Number(value) > 0, 'Informe um valor'),
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
      toast.success('Compra parcelada criada');
      navigate(-1);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  return (
    <ModalRoute title="Nova compra parcelada">
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
            <Input
              id="descricao"
              placeholder="Notebook"
              {...register('descricao')}
            />
            <FieldError errors={[errors.descricao]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="valorTotal">Valor total</FieldLabel>
            <MoneyField control={control} />
            <FieldError errors={[errors.valorTotal]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="numeroParcelas">Número de parcelas</FieldLabel>
            <Input
              id="numeroParcelas"
              type="number"
              min={1}
              {...register('numeroParcelas', { valueAsNumber: true })}
            />
            <FieldError errors={[errors.numeroParcelas]} />
          </Field>

          {preview && (
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {preview.numeroParcelas}x de{' '}
              {formatMoney(preview.installmentDisplay)}
              {preview.lastDiffers && (
                <>
                  {' '}
                  (última parcela {formatMoney(preview.lastDisplay)}, ajuste de
                  centavos)
                </>
              )}
            </p>
          )}

          <Field>
            <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>
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
            <FieldLabel htmlFor="dataCompra">Data da compra</FieldLabel>
            <DateField control={control} />
            <FieldError errors={[errors.dataCompra]} />
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={isSubmitting} className="mt-6 w-full">
          Salvar
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
    <MoneyInput id="valorTotal" value={field.value} onChange={field.onChange} />
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
