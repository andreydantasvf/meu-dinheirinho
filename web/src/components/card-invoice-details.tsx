import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconUser,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionRow } from '@/components/transaction-row';
import { DeleteTransactionDialog } from '@/components/delete-transaction-dialog';
import { useCategories } from '@/hooks/use-categories';
import { useFatura } from '@/hooks/use-fatura';
import { useExtrato } from '@/hooks/use-transactions';
import { apiStringToCents, centsToApiString, formatMoney } from '@/lib/money';
import { currentMonth, formatMonthLabel, shiftMonth } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Account, Transaction } from '@/types/entities';

// Resumo de uma fatura (mês civil, como o backend — ver docs/api.md) calculado a
// partir dos itens do mês, para valer em qualquer mês navegado e não só no atual
// (`terceirosFaturaAtual` da API cobre apenas o mês corrente). Compras de terceiros
// entram no total, mas não no "seu gasto".
function summarizeInvoice(items: Transaction[]) {
  let totalCents = 0;
  const terceiros = new Map<string, number>();
  for (const item of items) {
    const cents = apiStringToCents(item.valor);
    totalCents += cents;
    if (item.terceiro) {
      terceiros.set(item.terceiro, (terceiros.get(item.terceiro) ?? 0) + cents);
    }
  }
  const terceirosCents = [...terceiros.values()].reduce((a, b) => a + b, 0);
  return {
    totalCents,
    seuGastoCents: totalCents - terceirosCents,
    terceiros: [...terceiros.entries()]
      .map(([nome, cents]) => ({ nome, cents }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

export function CardInvoiceDetails({
  account,
  mes,
  onMesChange,
}: {
  account: Account;
  mes: string;
  onMesChange: (mes: string) => void;
}) {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: fatura } = useFatura(account.id);
  const {
    data: items,
    isLoading,
    isError,
  } = useExtrato({ accountId: account.id, mes });
  const [deleting, setDeleting] = useState<Transaction | undefined>(undefined);

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c.id, c])),
    [categories],
  );
  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.data.localeCompare(a.data)),
    [items],
  );
  const summary = useMemo(() => summarizeInvoice(items ?? []), [items]);
  const isCurrentMonth = mes === currentMonth();

  return (
    <div className="flex flex-col gap-4">
      {/* Navegação entre faturas */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fatura anterior"
          onClick={() => onMesChange(shiftMonth(mes, -1))}
          className="size-9 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <IconChevronLeft size={20} />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-foreground tracking-tight">
            Fatura de {formatMonthLabel(mes).toLowerCase()}
          </span>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => onMesChange(currentMonth())}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Voltar para a fatura atual
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próxima fatura"
          onClick={() => onMesChange(shiftMonth(mes, 1))}
          className="size-9 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <IconChevronRight size={20} />
        </Button>
      </div>

      {sorted.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
          <div className="flex justify-between text-xs font-semibold text-foreground">
            <span>Total da fatura</span>
            <span className="font-extrabold tabular-nums">
              {formatMoney(centsToApiString(summary.totalCents))}
            </span>
          </div>
          {summary.terceiros.length > 0 && (
            <>
              <span className="mt-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Terceiros nesta fatura
              </span>
              {summary.terceiros.map((terceiro) => (
                <div
                  key={terceiro.nome}
                  className="flex justify-between gap-3 text-xs font-medium text-muted-foreground"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <IconUser size={13} className="shrink-0" />
                    <span className="truncate">{terceiro.nome}</span>
                  </span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatMoney(centsToApiString(terceiro.cents))}
                  </span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-xs font-semibold text-foreground">
                <span>Seu gasto</span>
                <span className="font-extrabold tabular-nums">
                  {formatMoney(centsToApiString(summary.seuGastoCents))}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Itens da fatura
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
            Nenhum lançamento nesta fatura.
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
                onEdit={() =>
                  navigate(
                    transaction.purchaseId
                      ? `/compras/${transaction.purchaseId}`
                      : `/transacoes/${transaction.id}`,
                  )
                }
                onDelete={() => setDeleting(transaction)}
              />
            ))}
          </div>
        )}
      </div>

      {fatura && fatura.faturasFuturas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Faturas Futuras
          </span>
          <div className="flex flex-col gap-0.5">
            {fatura.faturasFuturas.map((future) => (
              <button
                type="button"
                key={future.mes}
                onClick={() => onMesChange(future.mes)}
                className={cn(
                  '-mx-2 flex justify-between rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5',
                  future.mes === mes && 'bg-primary/10 text-primary',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <IconCalendar size={13} />
                  {formatMonthLabel(future.mes)}
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatMoney(future.total)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DeleteTransactionDialog
        transaction={deleting}
        onClose={() => setDeleting(undefined)}
      />
    </div>
  );
}
