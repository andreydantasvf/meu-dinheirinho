import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
      toast.success('Conta excluída');
    } catch (error) {
      // The backend doesn't map the FK-violation-on-delete case to a friendly error yet
      // (docs/api.md) — a 500 here almost always means the account still has entries.
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
    <div className="p-4 pb-24">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as contas.
        </p>
      )}

      {accounts && accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta cadastrada ainda.
        </p>
      )}

      {cards.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Cartões de crédito
          </h2>
          <div className="flex flex-col gap-3">
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

      {others.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Outras contas
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">
                    {account.nome}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {accountTypeLabels[account.tipo]}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar conta"
                  onClick={() => openEdit(account)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Excluir conta"
                  onClick={() => setDeleting(account)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button
        onClick={openCreate}
        size="icon-lg"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] rounded-full shadow-lg"
        aria-label="Nova conta"
      >
        <Plus />
      </Button>

      <AccountFormDialog
        account={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "{deleting?.nome}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{account.nome}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Editar conta"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir conta"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-16 w-full" />}

      {fatura && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fatura atual</span>
            <span className="font-medium">
              {formatMoney(fatura.faturaAtual)}
            </span>
          </div>

          <div className="mb-1 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {formatMoney(fatura.limiteDisponivel)} disponível de{' '}
            {formatMoney(account.limite ?? '0')}
          </p>

          {fatura.faturasFuturas.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              {fatura.faturasFuturas.map((future) => (
                <div
                  key={future.mes}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>{formatMonthLabel(future.mes)}</span>
                  <span>{formatMoney(future.total)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
