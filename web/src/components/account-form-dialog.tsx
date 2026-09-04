import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
  ControlledSelect,
  ControlledMoneyInput,
} from '@/components/controlled-fields';
import { CardColorPicker } from '@/components/card-color-picker';
import { ApiError } from '@/lib/api';
import { useCreateAccount, useUpdateAccount } from '@/hooks/use-accounts';
import { accountTypeLabels } from '@/types/entities';
import type { Account, AccountType } from '@/types/entities';
import { getCardColorId, setCardColorId } from '@/lib/card-colors';

const dayField = z
  .number()
  .int()
  .min(1, 'Entre 1 e 31')
  .max(31, 'Entre 1 e 31')
  .optional();

function toOptionalDay(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}

const accountSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe um nome'),
    tipo: z.enum(['CONTA_CORRENTE', 'DINHEIRO', 'CARTAO_CREDITO']),
    limite: z.string().optional(),
    diaFechamento: dayField,
    diaVencimento: dayField,
    cor: z.string().optional(),
  })
  .refine(
    (data) =>
      data.tipo !== 'CARTAO_CREDITO' ||
      (data.limite &&
        Number(data.limite) > 0 &&
        data.diaFechamento &&
        data.diaVencimento),
    {
      message: 'Preencha limite, dia de fechamento e dia de vencimento',
      path: ['limite'],
    },
  );

type AccountFormValues = z.infer<typeof accountSchema>;

const defaultValues: AccountFormValues = {
  nome: '',
  tipo: 'CONTA_CORRENTE',
  limite: '0.00',
  diaFechamento: undefined,
  diaVencimento: undefined,
  cor: 'roxo',
};

export function AccountFormDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = Boolean(account);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      account
        ? {
            nome: account.nome,
            tipo: account.tipo,
            limite: account.limite ?? '0.00',
            diaFechamento: account.diaFechamento ?? undefined,
            diaVencimento: account.diaVencimento ?? undefined,
            cor: getCardColorId(account.id, account.nome),
          }
        : defaultValues,
    );
  }, [open, account, reset]);

  const tipo = watch('tipo');
  const isCard = tipo === 'CARTAO_CREDITO';

  async function onSubmit(values: AccountFormValues) {
    const payload = isCard ? values : { nome: values.nome, tipo: values.tipo };
    try {
      if (isEditing && account) {
        await updateAccount.mutateAsync({ id: account.id, ...payload });
        if (values.cor) {
          setCardColorId(account.id, values.cor);
        }
        toast.success('Conta atualizada');
      } else {
        const newAcc = await createAccount.mutateAsync(payload);
        if (newAcc?.id && values.cor) {
          setCardColorId(newAcc.id, values.cor);
        }
        toast.success('Conta criada');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input
                id="nome"
                placeholder="Nubank, Itaú, Inter..."
                {...register('nome')}
              />
              <FieldError errors={[errors.nome]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
              <ControlledSelect
                control={control}
                name="tipo"
                options={(Object.keys(accountTypeLabels) as AccountType[]).map(
                  (value) => ({
                    value,
                    label: accountTypeLabels[value],
                  }),
                )}
              />
            </Field>

            {isCard && (
              <>
                <Field>
                  <FieldLabel>Cor / Visual do Cartão</FieldLabel>
                  <CardColorPicker control={control} name="cor" />
                </Field>

                <Field>
                  <FieldLabel htmlFor="limite">Limite</FieldLabel>
                  <ControlledMoneyInput control={control} name="limite" />
                  <FieldError errors={[errors.limite]} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="diaFechamento">Fechamento</FieldLabel>
                    <Input
                      id="diaFechamento"
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Dia ex: 5"
                      {...register('diaFechamento', {
                        setValueAs: toOptionalDay,
                      })}
                    />
                    <FieldError errors={[errors.diaFechamento]} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="diaVencimento">Vencimento</FieldLabel>
                    <Input
                      id="diaVencimento"
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Dia ex: 10"
                      {...register('diaVencimento', {
                        setValueAs: toOptionalDay,
                      })}
                    />
                    <FieldError errors={[errors.diaVencimento]} />
                  </Field>
                </div>
              </>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full font-bold"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
