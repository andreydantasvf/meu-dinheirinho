import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { TransactionRow } from '@/components/transaction-row';

const ALL = 'all';
type TypeFilter = 'ALL' | 'RECEITA' | 'DESPESA';

export default function Extrato() {
  const navigate = useNavigate();
  const [mes, setMes] = useState(currentMonth());
  const [tipoFilter, setTipoFilter] = useState<TypeFilter>('ALL');
  const [categoriaId, setCategoriaId] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [deleting, setDeleting] = useState<Transaction | undefined>(undefined);

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const {
    data: rawTransactions,
    isLoading,
    isError,
  } = useExtrato({
    mes,
    categoriaId: categoriaId === ALL ? undefined : categoriaId,
    accountId: accountId === ALL ? undefined : accountId,
  });
  const deleteTransaction = useDeleteTransaction();

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c.id, c])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts?.map((a) => [a.id, a])),
    [accounts],
  );

  // Filter transactions by type filter
  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    if (tipoFilter === 'ALL') return rawTransactions;
    return rawTransactions.filter((t) => t.tipo === tipoFilter);
  }, [rawTransactions, tipoFilter]);

  const groups = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => b.data.localeCompare(a.data));
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
    <div className="flex flex-col gap-4 p-4">
      {/* Month Navigator Header */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMes(shiftMonth(mes, -1))}
          className="size-9 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <IconChevronLeft size={20} />
        </Button>
        <span className="text-base font-bold text-foreground tracking-tight">
          {formatMonthLabel(mes)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMes(shiftMonth(mes, 1))}
          className="size-9 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <IconChevronRight size={20} />
        </Button>
      </div>

      {/* Quick Type Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setTipoFilter('ALL')}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
            tipoFilter === 'ALL'
              ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,200,255,0.3)]'
              : 'bg-foreground/5 border border-border text-muted-foreground hover:bg-foreground/10',
          )}
        >
          Tudo
        </button>
        <button
          type="button"
          onClick={() => setTipoFilter('RECEITA')}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
            tipoFilter === 'RECEITA'
              ? 'bg-success text-success-foreground shadow-[0_0_12px_rgba(34,211,160,0.3)]'
              : 'bg-foreground/5 border border-border text-muted-foreground hover:bg-foreground/10',
          )}
        >
          Entradas
        </button>
        <button
          type="button"
          onClick={() => setTipoFilter('DESPESA')}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
            tipoFilter === 'DESPESA'
              ? 'bg-foreground text-background'
              : 'bg-foreground/5 border border-border text-muted-foreground hover:bg-foreground/10',
          )}
        >
          Saídas
        </button>
      </div>

      {/* Dropdown Filters */}
      <div className="flex gap-2">
        <Select value={categoriaId} onValueChange={setCategoriaId}>
          <SelectTrigger className="flex-1 rounded-xl border-border bg-card text-xs font-medium text-foreground">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="flex-1 rounded-xl border-border bg-card text-xs font-medium text-foreground">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas</SelectItem>
            {accounts?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
          <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
          <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm font-medium text-destructive">
          Não foi possível carregar o extrato.
        </p>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
          <IconFilter size={32} className="text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhuma transação encontrada para este filtro.
          </p>
        </div>
      )}

      {/* Grouped Days */}
      {groups.map(([day, items]) => {
        const dayTotal = items.reduce((acc, item) => {
          const val = Number(item.valor);
          return item.tipo === 'RECEITA' ? acc + val : acc - val;
        }, 0);

        return (
          <section key={day} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 pt-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {formatDateShort(items[0].data)}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  dayTotal >= 0 ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {dayTotal >= 0 ? '+' : ''} {formatMoney(dayTotal)}
              </span>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
              {items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={categoryMap.get(transaction.categoryId)}
                  account={accountMap.get(transaction.accountId)}
                  onEdit={() => navigate(`/transacoes/${transaction.id}`)}
                  onDelete={() => setDeleting(transaction)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Delete confirmation dialog */}
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
