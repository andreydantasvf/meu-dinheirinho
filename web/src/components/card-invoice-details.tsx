import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCalendar } from '@tabler/icons-react';
import { toast } from 'sonner';
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
import { TransactionRow } from '@/components/transaction-row';
import { useCategories } from '@/hooks/use-categories';
import { useFatura } from '@/hooks/use-fatura';
import { useDeleteTransaction, useExtrato } from '@/hooks/use-transactions';
import { formatMoney } from '@/lib/money';
import { currentMonth, formatMonthLabel } from '@/lib/date';
import { ApiError } from '@/lib/api';
import type { Account, Transaction } from '@/types/entities';

export function CardInvoiceDetails({ account }: { account: Account }) {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: fatura } = useFatura(account.id);
  const {
    data: items,
    isLoading,
    isError,
  } = useExtrato({ accountId: account.id, mes: currentMonth() });
  const deleteTransaction = useDeleteTransaction();
  const [deleting, setDeleting] = useState<Transaction | undefined>(undefined);

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c.id, c])),
    [categories],
  );
  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.data.localeCompare(a.data)),
    [items],
  );

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteTransaction.mutateAsync({
        id: deleting.id,
        accountId: deleting.accountId,
      });
      toast.success('Transação excluída com sucesso');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {fatura && fatura.faturasFuturas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
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

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Itens da fatura atual
        </span>

        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
            <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
          </div>
        )}

        {isError && (
          <p className="py-4 text-center text-sm font-medium text-destructive">
            Não foi possível carregar os itens da fatura.
          </p>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <p className="py-4 text-center text-sm font-medium text-muted-foreground">
            Nenhum lançamento nesta fatura ainda.
          </p>
        )}

        {sorted.length > 0 && (
          <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
            {sorted.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                category={categoryMap.get(transaction.categoryId)}
                account={account}
                onEdit={() => navigate(`/transacoes/${transaction.id}`)}
                onDelete={() => setDeleting(transaction)}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              A transação "{deleting?.descricao}" será removida permanentemente.
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
