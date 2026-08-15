import { useEffect } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { IconCheck } from '@tabler/icons-react';
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
import {
  BANK_COLOR_PRESETS,
  getCardColorId,
  setCardColorId,
} from '@/lib/card-colors';
import { cn } from '@/lib/utils';

const dayField = z.number().int().min(1, 'Entre 1 e 31').max(31, 'Entre 1 e 31').optional();

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
              <Input id="nome" placeholder="Nubank, Itaú, Inter..." {...register('nome')} />
              <FieldError errors={[errors.nome]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
              <TipoField control={control} />
            </Field>

            {isCard && (
              <>
                <Field>
                  <FieldLabel>Cor / Visual do Cartão</FieldLabel>
                  <CorPickerField control={control} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="limite">Limite</FieldLabel>
                  <LimiteField control={control} />
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
                      {...register('diaFechamento', { setValueAs: toOptionalDay })}
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
                      {...register('diaVencimento', { setValueAs: toOptionalDay })}
                    />
                    <FieldError errors={[errors.diaVencimento]} />
                  </Field>
                </div>
              </>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold">
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

function CorPickerField({
  control,
}: {
  control: ReturnType<typeof useForm<AccountFormValues>>['control'];
}) {
  const { field } = useController({ control, name: 'cor' });
  const selectedColorId = field.value || 'roxo';

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {BANK_COLOR_PRESETS.map((preset) => {
        const isSelected = selectedColorId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => field.onChange(preset.id)}
            title={`${preset.name} (${preset.bankLabel})`}
            className={cn(
              'relative flex size-8 items-center justify-center rounded-full transition-transform active:scale-95',
              preset.swatchBg,
              isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'opacity-85 hover:opacity-100 hover:scale-105',
            )}
          >
            {isSelected && <IconCheck size={16} className="text-white drop-shadow" stroke={3} />}
          </button>
        );
      })}
    </div>
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
