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
import { useCreateAccount, useUpdateAccount } from '@/hooks/use-accounts';
import { accountTypeLabels } from '@/types/entities';
import type { Account, AccountType } from '@/types/entities';

const dayField = z.number().int().min(1, 'Entre 1 e 31').max(31, 'Entre 1 e 31').optional();

// Empty <input type="number"> yields '', which Number('') coerces to 0 (not NaN) — map it to
// undefined explicitly so an untouched field doesn't fail the day-range validation as "0".
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
        toast.success('Conta atualizada');
      } else {
        await createAccount.mutateAsync(payload);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" placeholder="Nubank" {...register('nome')} />
              <FieldError errors={[errors.nome]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
              <TipoField control={control} />
            </Field>

            {isCard && (
              <>
                <Field>
                  <FieldLabel htmlFor="limite">Limite</FieldLabel>
                  <LimiteField control={control} />
                  <FieldError errors={[errors.limite]} />
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel htmlFor="diaFechamento">
                    Dia de fechamento
                  </FieldLabel>
                  <Input
                    id="diaFechamento"
                    type="number"
                    min={1}
                    max={31}
                    className="w-20"
                    {...register('diaFechamento', { setValueAs: toOptionalDay })}
                  />
                  <FieldError errors={[errors.diaFechamento]} />
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel htmlFor="diaVencimento">
                    Dia de vencimento
                  </FieldLabel>
                  <Input
                    id="diaVencimento"
                    type="number"
                    min={1}
                    max={31}
                    className="w-20"
                    {...register('diaVencimento', { setValueAs: toOptionalDay })}
                  />
                  <FieldError errors={[errors.diaVencimento]} />
                </Field>
              </>
            )}
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

function TipoField({
  control,
}: {
  control: ReturnType<typeof useForm<AccountFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'tipo' });
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger id="tipo" className="w-full">
        <SelectValue>{accountTypeLabels[field.value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(accountTypeLabels) as AccountType[]).map((value) => (
          <SelectItem key={value} value={value}>
            {accountTypeLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LimiteField({
  control,
}: {
  control: ReturnType<typeof useForm<AccountFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'limite' });
  return (
    <MoneyInput
      id="limite"
      value={field.value ?? '0.00'}
      onChange={field.onChange}
    />
  );
}
