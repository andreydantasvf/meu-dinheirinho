import { useState } from 'react';
import {
  IconCreditCard,
  IconPencil,
  IconTrash,
  IconPlus,
  IconCalendar,
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
import { AccountFormDialog } from '@/components/account-form-dialog';
import { useAccounts, useDeleteAccount } from '@/hooks/use-accounts';
import { useFatura } from '@/hooks/use-fatura';
import { formatMoney } from '@/lib/money';
import { formatMonthLabel } from '@/lib/date';
import { ApiError } from '@/lib/api';
import { accountTypeLabels } from '@/types/entities';
import type { Account } from '@/types/entities';

export default function Cartoes() {
  const { data: accounts, isLoading, isError } = useAccounts();
  const deleteAccount = useDeleteAccount();

  const [editing, setEditing] = useState<Account | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | undefined>(undefined);

  const cards =
    accounts?.filter((account) => account.tipo === 'CARTAO_CREDITO') ?? [];
  const others =
    accounts?.filter((account) => account.tipo !== 'CARTAO_CREDITO') ?? [];

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteAccount.mutateAsync(deleting.id);
      toast.success('Conta excluída com sucesso');
    } catch (error) {
      if (error instanceof ApiError && error.status === 500) {
        toast.error('Não é possível excluir uma conta com lançamentos');
      } else {
        toast.error(
          error instanceof ApiError
            ? error.message
            : 'Não foi possível excluir',
        );
      }
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Cartões e Contas</h2>
        <Button
          onClick={openCreate}
          size="sm"
          className="gap-1.5 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)] hover:bg-primary/90"
        >
          <IconPlus size={16} stroke={2.5} /> Nova Conta
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-3xl bg-foreground/5" />
          <Skeleton className="h-20 w-full rounded-2xl bg-foreground/5" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm font-medium text-destructive">
          Não foi possível carregar as contas e cartões.
        </p>
      )}

      {accounts && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
          <IconCreditCard size={40} className="text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Nenhuma conta ou cartão cadastrado ainda.
          </p>
          <Button
            onClick={openCreate}
            className="rounded-xl bg-primary font-bold text-primary-foreground"
          >
            Cadastrar primeiro cartão
          </Button>
        </div>
      )}

      {/* Credit Cards Section */}
      {cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground px-1">
            Cartões de Crédito
          </span>
          <div className="flex flex-col gap-4">
            {cards.map((account) => (
              <CardSummary
                key={account.id}
                account={account}
                onEdit={() => openEdit(account)}
                onDelete={() => setDeleting(account)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Other Accounts Section */}
      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground px-1">
            Outras Contas & Bancos
          </span>
          <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
            {others.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between border-b border-border p-4 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-foreground/5 text-primary">
                    <IconCreditCard size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {account.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {accountTypeLabels[account.tipo]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar conta"
                    onClick={() => openEdit(account)}
                    className="size-8 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  >
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir conta"
                    onClick={() => setDeleting(account)}
                    className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  >
                    <IconTrash size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AccountFormDialog
        account={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "{deleting?.nome}" será removida permanentemente.
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

function CardSummary({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: fatura, isLoading } = useFatura(account.id);
  const limite = Number(account.limite ?? 0);
  const disponivel = fatura ? Number(fatura.limiteDisponivel) : limite;
  const usedPct =
    limite > 0
      ? Math.min(100, Math.max(0, ((limite - disponivel) / limite) * 100))
      : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-secondary to-popover p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Top Bar of Card */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-bold text-foreground tracking-tight">{account.nome}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {account.diaFechamento ? `Fecha dia ${account.diaFechamento}` : 'Fatura aberta'}{' '}
            {account.diaVencimento ? `· Vence dia ${account.diaVencimento}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
            ABERTA
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="size-7 rounded-lg text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <IconPencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <IconTrash size={14} />
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="my-4 h-16 w-full rounded-2xl bg-foreground/5" />}

      {fatura && (
        <>
          {/* Main invoice figure */}
          <div className="my-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Fatura Atual
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold text-muted-foreground">R$</span>
              <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {formatMoney(fatura.faturaAtual).replace('R$', '').trim()}
              </span>
            </div>
          </div>

          {/* Progress bar of used limit */}
          <div className="flex flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_16px_rgba(0,200,255,0.5)] transition-all duration-500"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>Limite utilizado</span>
              <span className="font-bold text-foreground tabular-nums">
                R$ {formatMoney(fatura.limiteDisponivel).replace('R$', '').trim()} disponível
              </span>
            </div>
          </div>

          {/* Future Invoices breakdown */}
          {fatura.faturasFuturas.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Faturas Futuras
              </span>
              <div className="flex flex-col gap-1.5">
                {fatura.faturasFuturas.map((future) => (
                  <div
                    key={future.mes}
                    className="flex justify-between text-xs font-medium text-muted-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={13} className="text-muted-foreground" />
                      {formatMonthLabel(future.mes)}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatMoney(future.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
