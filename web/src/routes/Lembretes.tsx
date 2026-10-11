import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBell,
  IconBellOff,
  IconBellRinging,
  IconDotsVertical,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReminderFormDialog } from '@/components/reminder-form-dialog';
import {
  useDeleteReminder,
  useReminders,
  useTestReminder,
  useUpdateReminder,
} from '@/hooks/use-reminders';
import { usePush, type PushStatus } from '@/hooks/use-push';
import { ApiError } from '@/lib/api';
import { formatUtcDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Reminder, ReminderTestResult } from '@/types/entities';

const canalLabels: Record<string, string> = {
  discord: 'Discord',
  'web-push': 'Push',
};

const statusLabels: Record<
  ReminderTestResult['canais'][number]['status'],
  string
> = {
  enviado: 'enviado',
  falhou: 'falhou',
  desativado: 'não configurado',
};

function describeSchedule(reminder: Reminder): string {
  const quando =
    reminder.recorrencia === 'MENSAL'
      ? `Todo dia ${reminder.diaDoMes}`
      : reminder.dataUnica
        ? formatUtcDate(reminder.dataUnica)
        : '—';
  const antecedencia =
    reminder.diasAntecedencia === 0
      ? ''
      : reminder.diasAntecedencia === 1
        ? ' · avisa 1 dia antes'
        : ` · avisa ${reminder.diasAntecedencia} dias antes`;
  return `${quando} · ${reminder.horario}${antecedencia}`;
}

function describeNext(reminder: Reminder): string {
  if (!reminder.ativo) return 'Pausado';
  if (!reminder.proximoDisparo) return 'Encerrado';
  return `Próximo aviso: ${format(parseISO(reminder.proximoDisparo), "dd/MM 'às' HH:mm")}`;
}

const pushMessages: Record<PushStatus, string> = {
  loading: 'Verificando…',
  unsupported:
    'Este navegador não suporta notificações. No iPhone, instale o app pela opção "Adicionar à Tela de Início" (iOS 16.4+) e abra por lá.',
  'no-service-worker':
    'Notificações só funcionam na versão instalada/build do app (o service worker não roda no modo de desenvolvimento).',
  'server-disabled':
    'Web Push não está configurado no servidor (faltam as chaves VAPID).',
  denied:
    'As notificações foram bloqueadas. Libere nas configurações do navegador ou do iPhone para este app.',
  unsubscribed: 'Ative para receber os lembretes neste dispositivo.',
  subscribed: 'Este dispositivo recebe os lembretes.',
};

function PushCard() {
  const { status, isWorking, subscribe, unsubscribe } = usePush();
  const canToggle = status === 'subscribed' || status === 'unsubscribed';

  async function handleToggle() {
    try {
      if (status === 'subscribed') {
        await unsubscribe();
        toast.success('Notificações desativadas neste dispositivo');
      } else {
        await subscribe();
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Não foi possível alterar as notificações',
      );
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-2xl',
          status === 'subscribed'
            ? 'bg-primary/15 text-primary'
            : 'bg-foreground/5 text-muted-foreground',
        )}
      >
        {status === 'subscribed' ? (
          <IconBellRinging size={20} />
        ) : (
          <IconBellOff size={20} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold text-foreground">
          Notificações neste dispositivo
        </span>
        <span className="text-xs text-muted-foreground">
          {pushMessages[status]}
        </span>
      </div>
      {canToggle && (
        <Button
          size="sm"
          variant={status === 'subscribed' ? 'outline' : 'default'}
          disabled={isWorking}
          onClick={handleToggle}
          className="shrink-0 rounded-full font-bold"
        >
          {status === 'subscribed' ? 'Desativar' : 'Ativar'}
        </Button>
      )}
    </div>
  );
}

export default function Lembretes() {
  const { data: reminders, isLoading, isError } = useReminders();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const testReminder = useTestReminder();

  const [editing, setEditing] = useState<Reminder | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Reminder | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(reminder: Reminder) {
    setEditing(reminder);
    setFormOpen(true);
  }

  async function toggleAtivo(reminder: Reminder) {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        ativo: !reminder.ativo,
      });
      toast.success(reminder.ativo ? 'Lembrete pausado' : 'Lembrete retomado');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível alterar',
      );
    }
  }

  async function sendTest(reminder: Reminder) {
    try {
      const { canais } = await testReminder.mutateAsync(reminder.id);
      const resumo = canais
        .map(
          (c) =>
            `${canalLabels[c.canal] ?? c.canal}: ${statusLabels[c.status]}`,
        )
        .join(' · ');
      if (canais.some((c) => c.status === 'enviado')) {
        toast.success('Teste enviado', { description: resumo });
      } else {
        toast.error('Nenhum canal enviou', { description: resumo });
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível testar',
      );
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteReminder.mutateAsync(deleting.id);
      toast.success('Lembrete excluído');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Lembretes
        </h2>
        <Button
          onClick={openCreate}
          size="sm"
          className="gap-1.5 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)] hover:bg-primary/90"
        >
          <IconPlus size={16} stroke={2.5} /> Novo
        </Button>
      </div>

      <PushCard />

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
          <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm font-medium text-destructive">
          Não foi possível carregar os lembretes.
        </p>
      )}

      {reminders && reminders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
          <IconBell size={36} className="mb-3 text-muted-foreground" />
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            Nenhum lembrete ainda. Crie um para ser avisado de pagamentos e
            recebimentos.
          </p>
          <Button
            onClick={openCreate}
            className="rounded-xl bg-primary font-bold text-primary-foreground"
          >
            Criar lembrete
          </Button>
        </div>
      )}

      {reminders && reminders.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:rounded-none md:border-none md:bg-transparent">
          {reminders.map((reminder) => {
            const isEntrada = reminder.tipo === 'ENTRADA';
            const TipoIcon = isEntrada ? IconArrowDownLeft : IconArrowUpRight;
            return (
              <div
                key={reminder.id}
                className={cn(
                  'flex items-center gap-3 border-b border-border p-4 last:border-b-0 md:rounded-3xl md:border md:bg-card md:p-5',
                  !reminder.ativo && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  onClick={() => openEdit(reminder)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                      isEntrada
                        ? 'bg-success/15 text-success'
                        : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    <TipoIcon size={20} stroke={2.25} />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-foreground">
                      {reminder.titulo}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {describeSchedule(reminder)}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {describeNext(reminder)}
                    </span>
                  </div>
                </button>

                {reminder.valor && (
                  <span
                    className={cn(
                      'shrink-0 text-sm font-bold tabular-nums',
                      isEntrada ? 'text-success' : 'text-foreground',
                    )}
                  >
                    {formatMoney(reminder.valor)}
                  </span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ações do lembrete"
                      className="size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      <IconDotsVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => sendTest(reminder)}>
                      <IconSend /> Enviar teste
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => toggleAtivo(reminder)}>
                      {reminder.ativo ? (
                        <>
                          <IconPlayerPause /> Pausar
                        </>
                      ) : (
                        <>
                          <IconPlayerPlay /> Retomar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openEdit(reminder)}>
                      <IconPencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleting(reminder)}
                    >
                      <IconTrash /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <ReminderFormDialog
        reminder={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lembrete?</AlertDialogTitle>
            <AlertDialogDescription>
              O lembrete "{deleting?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
