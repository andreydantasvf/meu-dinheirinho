import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import { useDeleteTransaction, useExtrato } from '@/hooks/use-transactions';
import {
  formatDateShort,
  currentMonth,
  formatMonthLabel,
  shiftMonth,
} from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/entities';

const ALL = 'all';

export default function Extrato() {
  const navigate = useNavigate();
  const [mes, setMes] = useState(currentMonth());
  const [categoriaId, setCategoriaId] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [deleting, setDeleting] = useState<Transaction | undefined>(undefined);

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const {
    data: transactions,
    isLoading,
    isError,
  } = useExtrato({
    mes,
    categoriaId: categoriaId === ALL ? undefined : categoriaId,
    accountId: accountId === ALL ? undefined : accountId,
  });
  const deleteTransaction = useDeleteTransaction();

  const categoryMap = useMemo(
    () => new Map(categories?.map((category) => [category.id, category])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts?.map((account) => [account.id, account])),
    [accounts],
  );

  const groups = useMemo(() => {
    const sorted = [...(transactions ?? [])].sort((a, b) =>
      b.data.localeCompare(a.data),
    );
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of sorted) {
      const day = transaction.data.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), transaction]);
    }
    return Array.from(byDay.entries());
  }, [transactions]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteTransaction.mutateAsync({
        id: deleting.id,
        accountId: deleting.accountId,
      });
      toast.success('Transação excluída');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMes(shiftMonth(mes, -1))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">{formatMonthLabel(mes)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMes(shiftMonth(mes, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <Select value={categoriaId} onValueChange={setCategoriaId}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas</SelectItem>
            {accounts?.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o extrato.
        </p>
      )}

      {transactions && transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma transação neste mês.
        </p>
      )}

      {groups.map(([day, items]) => (
        <section key={day} className="mb-4">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">
            {formatDateShort(items[0].data)}
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((transaction) => {
              const isLocked = Boolean(transaction.purchaseId);
              const category = categoryMap.get(transaction.categoryId);
              const account = accountMap.get(transaction.accountId);

              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => navigate(`/transacoes/${transaction.id}`)}
                    className="flex flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: category?.cor ?? undefined }}
                    >
                      {category?.icone}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {transaction.descricao}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {category?.nome ?? 'Sem categoria'} ·{' '}
                        {account?.nome ?? 'Sem conta'}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        transaction.tipo === 'RECEITA'
                          ? 'text-emerald-600'
                          : 'text-red-600',
                      )}
                    >
                      {transaction.tipo === 'RECEITA' ? '+' : '-'}
                      {formatMoney(transaction.valor)}
                    </span>
                    {isLocked && (
                      <Badge variant="outline" className="text-xs">
                        Parcela {transaction.parcelaNumero}/
                        {transaction.parcelaTotal}
                      </Badge>
                    )}
                  </div>

                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir transação"
                      onClick={() => setDeleting(transaction)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              A transação "{deleting?.descricao}" será removida permanentemente.
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
