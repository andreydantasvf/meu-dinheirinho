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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  ControlledDatePicker,
  ControlledMoneyInput,
  ControlledSelect,
} from '@/components/controlled-fields';
import { ApiError } from '@/lib/api';
import { localIsoToDateOnly, utcDateToLocalIso } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useCreateReminder, useUpdateReminder } from '@/hooks/use-reminders';
import type { Reminder } from '@/types/entities';

// All fields stay strings in the form (no z.preprocess/z.coerce — see the tsc -b
// gotcha in docs/web-architecture.md) and are converted in onSubmit.
const reminderSchema = z
  .object({
    titulo: z.string().trim().min(1, 'Informe um título'),
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string(),
    recorrencia: z.enum(['MENSAL', 'UNICO']),
    diaDoMes: z.string(),
    dataUnica: z.string(),
    horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
    diasAntecedencia: z.string(),
  })
  .superRefine((values, ctx) => {
    const dia = Number(values.diaDoMes);
    if (
      values.recorrencia === 'MENSAL' &&
      !(Number.isInteger(dia) && dia >= 1 && dia <= 31)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um dia entre 1 e 31',
        path: ['diaDoMes'],
      });
    }
    if (values.recorrencia === 'UNICO' && !values.dataUnica) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecione uma data',
        path: ['dataUnica'],
      });
    }
  });

type ReminderFormValues = z.infer<typeof reminderSchema>;

const defaultValues: ReminderFormValues = {
  titulo: '',
  tipo: 'SAIDA',
  valor: '0.00',
  recorrencia: 'MENSAL',
  diaDoMes: String(new Date().getDate()),
  dataUnica: '',
  horario: '09:00',
  diasAntecedencia: '0',
};

const antecedenciaOptions = [
  { value: '0', label: 'No dia' },
  { value: '1', label: '1 dia antes' },
  ...[2, 3, 5, 7].map((n) => ({ value: String(n), label: `${n} dias antes` })),
];

function toFormValues(reminder: Reminder): ReminderFormValues {
  return {
    titulo: reminder.titulo,
    tipo: reminder.tipo,
    valor: reminder.valor ?? '0.00',
    recorrencia: reminder.recorrencia,
    diaDoMes: reminder.diaDoMes ? String(reminder.diaDoMes) : '',
    dataUnica: reminder.dataUnica ? utcDateToLocalIso(reminder.dataUnica) : '',
    horario: reminder.horario,
    diasAntecedencia: String(reminder.diasAntecedencia),
  };
}

export function ReminderFormDialog({
  reminder,
  open,
  onOpenChange,
}: {
  reminder?: Reminder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = Boolean(reminder);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(reminder ? toFormValues(reminder) : defaultValues);
  }, [open, reminder, reset]);

  const tipo = watch('tipo');
  const recorrencia = watch('recorrencia');

  async function onSubmit(values: ReminderFormValues) {
    const isMensal = values.recorrencia === 'MENSAL';
    const payload = {
      titulo: values.titulo,
      tipo: values.tipo,
      valor: Number(values.valor) > 0 ? values.valor : null,
      recorrencia: values.recorrencia,
      diaDoMes: isMensal ? Number(values.diaDoMes) : null,
      dataUnica: isMensal ? null : localIsoToDateOnly(values.dataUnica),
      horario: values.horario,
      diasAntecedencia: Number(values.diasAntecedencia),
    };
    try {
      if (isEditing && reminder) {
        await updateReminder.mutateAsync({ id: reminder.id, ...payload });
        toast.success('Lembrete atualizado');
      } else {
        await createReminder.mutateAsync(payload);
        toast.success('Lembrete criado');
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar lembrete' : 'Novo lembrete'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5">
              <button
                type="button"
                onClick={() => setValue('tipo', 'SAIDA')}
                className={cn(
                  'flex-1 rounded-xl py-2 text-center text-xs font-bold transition-all',
                  tipo === 'SAIDA'
                    ? 'bg-destructive text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Pagamento
              </button>
              <button
                type="button"
                onClick={() => setValue('tipo', 'ENTRADA')}
                className={cn(
                  'flex-1 rounded-xl py-2 text-center text-xs font-bold transition-all',
                  tipo === 'ENTRADA'
                    ? 'bg-success text-success-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Recebimento
              </button>
            </div>

            <Field>
              <FieldLabel htmlFor="titulo">Título</FieldLabel>
              <Input
                id="titulo"
                placeholder={
                  tipo === 'ENTRADA' ? 'Freela da Nara' : 'Parcela da geladeira'
                }
                {...register('titulo')}
              />
              <FieldError errors={[errors.titulo]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="valor">Valor (opcional)</FieldLabel>
              <ControlledMoneyInput control={control} name="valor" />
              <FieldDescription>
                Só aparece na notificação — lembretes não mexem no saldo.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="recorrencia">Repetição</FieldLabel>
              <ControlledSelect
                control={control}
                name="recorrencia"
                options={[
                  { value: 'MENSAL', label: 'Todo mês' },
                  { value: 'UNICO', label: 'Uma vez' },
                ]}
              />
            </Field>

            {recorrencia === 'MENSAL' ? (
              <Field>
                <FieldLabel htmlFor="diaDoMes">Dia do mês</FieldLabel>
                <Input
                  id="diaDoMes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  {...register('diaDoMes')}
                />
                <FieldDescription>
                  Em meses mais curtos, cai no último dia.
                </FieldDescription>
                <FieldError errors={[errors.diaDoMes]} />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="dataUnica">Data</FieldLabel>
                <ControlledDatePicker control={control} name="dataUnica" />
                <FieldError errors={[errors.dataUnica]} />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="horario">Horário</FieldLabel>
                <Input id="horario" type="time" {...register('horario')} />
                <FieldError errors={[errors.horario]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="diasAntecedencia">Avisar</FieldLabel>
                <ControlledSelect
                  control={control}
                  name="diasAntecedencia"
                  options={antecedenciaOptions}
                />
              </Field>
            </div>
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
