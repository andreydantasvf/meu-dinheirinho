import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
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
  ControlledHeroMoneyInput,
  ControlledDatePicker,
  ControlledSelect,
} from '@/components/controlled-fields';
import { ApiError } from '@/lib/api';
import { apiStringToCents, centsToApiString, formatMoney } from '@/lib/money';
import { todayLocalIso } from '@/lib/date';
import { useCloseModal } from '@/hooks/use-close-modal';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import {
  useCreatePurchase,
  usePurchase,
  useUpdatePurchase,
} from '@/hooks/use-purchases';
import { useCreateFixedExpense } from '@/hooks/use-fixed-expenses';
import type { Purchase } from '@/types/entities';

const purchaseSchema = z
  .object({
    descricao: z.string().trim().min(1, 'Informe uma descrição'),
    valorTotal: z
      .string()
      .refine((value) => Number(value) > 0, 'Informe um valor maior que zero'),
    numeroParcelas: z.number().int().min(1, 'Informe ao menos 1 parcela'),
    categoryId: z.string().min(1, 'Selecione uma categoria'),
    accountId: z.string().min(1, 'Selecione uma conta'),
    dataCompra: z.string().min(1, 'Selecione uma data'),
    isSubscription: z.boolean().optional(),
    isTerceiro: z.boolean().optional(),
    terceiro: z.string().trim().max(60, 'Use no máximo 60 caracteres'),
  })
  .superRefine((values, ctx) => {
    if (values.isTerceiro && !values.terceiro) {
      ctx.addIssue({
        code: 'custom',
        path: ['terceiro'],
        message: 'Informe o nome de quem comprou',
      });
    }
  });

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

// Função (e não constante de módulo): a data padrão é "hoje" no momento em que o
// formulário abre, não quando o módulo carregou.
function emptyValues(): PurchaseFormValues {
  return {
    descricao: '',
    valorTotal: '0.00',
    numeroParcelas: 2,
    categoryId: '',
    accountId: '',
    dataCompra: todayLocalIso(),
    isSubscription: false,
    isTerceiro: false,
    terceiro: '',
  };
}

function toFormValues(purchase: Purchase): PurchaseFormValues {
  return {
    descricao: purchase.descricao,
    valorTotal: purchase.valorTotal,
    numeroParcelas: purchase.numeroParcelas,
    categoryId: purchase.categoryId,
    accountId: purchase.accountId,
    dataCompra: purchase.dataCompra,
    isSubscription: false,
    isTerceiro: Boolean(purchase.terceiro),
    terceiro: purchase.terceiro ?? '',
  };
}

export default function NovaCompraParcelada() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const closeModal = useCloseModal();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: purchase, isLoading: isLoadingPurchase } = usePurchase(id);
  const createPurchase = useCreatePurchase();
  const createFixedExpense = useCreateFixedExpense();
  const updatePurchase = useUpdatePurchase();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    values: purchase ? toFormValues(purchase) : emptyValues(),
  });

  const valorTotal = watch('valorTotal');
  const numeroParcelas = watch('numeroParcelas');
  const isSubscription = watch('isSubscription');
  const isTerceiro = watch('isTerceiro');
  const despesaCategories =
    categories?.filter((category) => category.tipo === 'DESPESA') ?? [];
  const creditCards =
    accounts?.filter((account) => account.tipo === 'CARTAO_CREDITO') ?? [];

  const preview = buildInstallmentPreview(valorTotal, numeroParcelas);

  async function onSubmit(values: PurchaseFormValues) {
    try {
      const { isSubscription, isTerceiro, terceiro, ...purchaseValues } =
        values;
      const purchaseInput = {
        ...purchaseValues,
        terceiro: isTerceiro ? terceiro : null,
      };
      if (isSubscription && !isEditing) {
        await createFixedExpense.mutateAsync({
          accountId: values.accountId,
          categoryId: values.categoryId,
          valor: values.valorTotal,
          descricao: values.descricao,
          dataInicio: values.dataCompra,
        });
        toast.success('Assinatura criada com sucesso');
      } else if (isEditing && id) {
        await updatePurchase.mutateAsync({ id, ...purchaseInput });
        toast.success('Compra parcelada atualizada com sucesso');
      } else {
        await createPurchase.mutateAsync(purchaseInput);
        toast.success('Compra parcelada criada com sucesso');
      }
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível salvar',
      );
    }
  }

  if (isEditing && isLoadingPurchase) {
    return (
      <ModalRoute title="Compra parcelada">
        <p className="py-8 text-center text-sm font-medium text-muted-foreground">
          Carregando...
        </p>
      </ModalRoute>
    );
  }

  return (
    <ModalRoute
      title={isEditing ? 'Editar compra parcelada' : 'Nova compra parcelada'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Hero Money Input */}
        <div className="flex flex-col items-center gap-1.5 py-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Valor Total
          </span>
          <ControlledHeroMoneyInput control={control} name="valorTotal" />
          <FieldError errors={[errors.valorTotal]} />
        </div>

        {!isSubscription && (
          <>
            {/* Installments Stepper Control */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="numeroParcelas"
                className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Número de parcelas
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setValue('numeroParcelas', Math.max(1, numeroParcelas - 1))
                  }
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
                    {preview.numeroParcelas} ×{' '}
                    {formatMoney(preview.installmentDisplay)}
                  </span>
                </div>
                {preview.lastDiffers && (
                  <p className="text-xs text-muted-foreground">
                    * Última parcela com ajuste de centavos:{' '}
                    {formatMoney(preview.lastDisplay)}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <FieldGroup className="flex flex-col gap-4">
          {/* Description Input */}
          <Field className="flex flex-col gap-2">
            <FieldLabel
              htmlFor="descricao"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
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
            <FieldLabel
              htmlFor="accountId"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Cartão de crédito
            </FieldLabel>
            <ControlledSelect
              control={control}
              name="accountId"
              placeholder="Selecione o cartão"
              options={creditCards.map((account) => ({
                value: account.id,
                label: account.nome,
              }))}
            />
            <FieldError errors={[errors.accountId]} />
          </Field>

          {/* Category Selector */}
          <Field className="flex flex-col gap-2">
            <FieldLabel
              htmlFor="categoryId"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Categoria
            </FieldLabel>
            <ControlledSelect
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
            <FieldLabel
              htmlFor="dataCompra"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Data da 1ª parcela
            </FieldLabel>
            <ControlledDatePicker control={control} name="dataCompra" />
            <FieldError errors={[errors.dataCompra]} />
          </Field>
        </FieldGroup>

        {/* Assinatura e compra de terceiro são excludentes: um esconde o outro. */}
        {!isSubscription && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 cursor-pointer transition-colors">
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-bold text-foreground">
                  Compra de outra pessoa?
                </span>
                <span className="text-xs text-muted-foreground">
                  Entra na fatura, mas não nos seus gastos
                </span>
              </div>
              <input
                type="checkbox"
                className="size-5 rounded border-border text-primary focus:ring-primary/20 bg-background"
                {...register('isTerceiro')}
              />
            </label>

            {isTerceiro && (
              <Field className="flex flex-col gap-2">
                <FieldLabel
                  htmlFor="terceiro"
                  className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  Nome de quem comprou
                </FieldLabel>
                <Input
                  id="terceiro"
                  placeholder="Ex: Maria"
                  maxLength={60}
                  className="h-12 rounded-xl border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground"
                  {...register('terceiro')}
                />
                <FieldError errors={[errors.terceiro]} />
              </Field>
            )}
          </div>
        )}

        {!isEditing && !isTerceiro && (
          <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-foreground/5 cursor-pointer transition-colors">
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-bold text-foreground">
                É uma assinatura?
              </span>
              <span className="text-xs text-muted-foreground">
                Valor fixo todo mês sem limite de parcelas
              </span>
            </div>
            <input
              type="checkbox"
              className="size-5 rounded border-border text-primary focus:ring-primary/20 bg-background"
              {...register('isSubscription')}
            />
          </label>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 h-14 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          {isSubmitting
            ? 'Salvando parcelas...'
            : isSubscription
              ? 'Criar assinatura'
              : isEditing
                ? `Atualizar ${numeroParcelas} lançamentos`
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
