import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowUpRight,
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/hooks/use-dashboard';
import { useExtrato } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useAccounts } from '@/hooks/use-accounts';
import { CategoryIcon } from '@/components/category-icon';
import { CategoryChart } from '@/components/category-chart';
import { ExpenseTypeChart, CardUsageChart } from '@/components/desktop-charts';
import { formatMoney } from '@/lib/money';
import { currentMonth, formatMonthLabel, shiftMonth } from '@/lib/date';
import { cn } from '@/lib/utils';
import { getUserName } from '@/lib/auth';

export default function Home() {
  const userName = getUserName();
  const [mes, setMes] = useState(currentMonth());
  const {
    data: dashboard,
    isLoading: isDashLoading,
    isError: isDashError,
  } = useDashboard(mes);
  const { data: transactions } = useExtrato({ mes });
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c.id, c])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts?.map((a) => [a.id, a])),
    [accounts],
  );

  const saldoMes = dashboard ? Number(dashboard.saldoMes) : 0;

  const gastoPorCategoria = useMemo(() => {
    return dashboard?.gastoPorCategoria ?? [];
  }, [dashboard?.gastoPorCategoria]);

  // Calculate total expense in category breakdown for progress bars
  const totalGastoCategorias = useMemo(() => {
    return gastoPorCategoria.reduce((acc, cat) => acc + Number(cat.total), 0);
  }, [gastoPorCategoria]);

  // Separate recent transactions
  const recentTransactions = useMemo(() => {
    return [...(transactions ?? [])]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 4);
  }, [transactions]);

  // Total income vs total expense from transactions in current month
  const { totalEntradas, totalSaidas } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const t of transactions ?? []) {
      const val = Number(t.valor);
      if (t.tipo === 'RECEITA') entradas += val;
      else saidas += val;
    }
    return { totalEntradas: entradas, totalSaidas: saidas };
  }, [transactions]);

  return (
    <div className="flex flex-col gap-5 p-4 md:grid md:grid-cols-2">
      {userName && (
        <div className="col-span-full mb-[-12px]">
          <p className="text-sm text-muted-foreground">Olá, {userName}</p>
        </div>
      )}

      {/* Month Navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2 col-span-full">
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

      {isDashLoading && (
        <div className="flex flex-col gap-4 col-span-full">
          <Skeleton className="h-44 w-full rounded-3xl bg-foreground/5" />
          <Skeleton className="h-48 w-full rounded-3xl bg-foreground/5" />
          <Skeleton className="h-44 w-full rounded-3xl bg-foreground/5" />
        </div>
      )}

      {isDashError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive col-span-full">
          Não foi possível carregar o painel financeiro.
        </div>
      )}

      {dashboard && (
        <>
          {/* Hero Card - Saldo do Mês */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-popover p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] md:col-span-2 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between lg:justify-start lg:gap-4">
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Saldo do Mês
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                  <IconArrowUpRight size={14} /> Ativo
                </span>
              </div>

              <div className="my-3 flex items-baseline gap-1">
                <span className="text-xl font-semibold text-muted-foreground">
                  R$
                </span>
                <span
                  className={cn(
                    'text-4xl font-extrabold tracking-tight tabular-nums',
                    saldoMes >= 0 ? 'text-foreground' : 'text-destructive',
                  )}
                >
                  {formatMoney(dashboard.saldoMes).replace('R$', '').trim()}
                </span>
              </div>
            </div>

            {/* Income & Expense Breakdown */}
            <div className="mt-4 flex gap-3 lg:mt-0 lg:w-96 lg:shrink-0">
              <div className="flex flex-1 flex-col gap-1 rounded-xl bg-foreground/[0.04] p-3 border border-border">
                <span className="text-xs font-medium text-muted-foreground">
                  Entradas
                </span>
                <span className="text-base font-bold text-success tabular-nums">
                  R$ {formatMoney(totalEntradas).replace('R$', '').trim()}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 rounded-xl bg-foreground/[0.04] p-3 border border-border">
                <span className="text-xs font-medium text-muted-foreground">
                  Saídas
                </span>
                <span className="text-base font-bold text-foreground tabular-nums">
                  R$ {formatMoney(totalSaidas).replace('R$', '').trim()}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Charts Area */}
          <div className="hidden md:grid md:grid-cols-2 gap-5 md:col-span-2">
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="mb-4">
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Despesas por Categoria
                </span>
              </div>
              <CategoryChart data={gastoPorCategoria} categories={categories ?? []} />
            </div>

            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="mb-4">
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Tipos de Despesa
                </span>
              </div>
              <ExpenseTypeChart transactions={transactions ?? []} />
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 md:col-span-2">
              <div className="mb-4">
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                  Faturas de Cartão
                </span>
              </div>
              <CardUsageChart faturas={dashboard.faturaAtualPorCartao} />
            </div>
          </div>

          {/* Gasto por Categoria Widget */}
          <div className="rounded-3xl border border-border bg-card p-5 md:col-span-1 h-full">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Gasto por categoria
              </span>
              <Link
                to="/categorias"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>

            {gastoPorCategoria.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhum gasto registrado neste mês.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {gastoPorCategoria.map((item) => {
                  const cat = categoryMap.get(item.categoriaId);
                  const itemVal = Number(item.total);
                  const meta = cat?.metaMensal ? Number(cat.metaMensal) : null;
                  const overBudget = meta !== null && itemVal > meta;
                  const pct =
                    meta !== null
                      ? Math.min(100, (itemVal / meta) * 100)
                      : totalGastoCategorias > 0
                        ? Math.round((itemVal / totalGastoCategorias) * 100)
                        : 0;
                  const barColor = overBudget
                    ? 'var(--destructive)'
                    : cat?.cor || 'var(--primary)';

                  return (
                    <div
                      key={item.categoriaId}
                      className="flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CategoryIcon
                            name={item.nome}
                            icon={cat?.icone}
                            color={cat?.cor}
                            size={14}
                            className="size-6 rounded-lg"
                          />
                          <span className="font-semibold text-foreground">
                            {item.nome}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            overBudget
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {meta !== null
                            ? `${formatMoney(item.total)} / ${formatMoney(meta)}`
                            : `${formatMoney(item.total)} (${pct}%)`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Últimas Transações Widget */}
          <div className="rounded-3xl border border-border bg-card p-5 md:col-span-1 h-full">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Últimas transações
              </span>
              <Link
                to="/extrato"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Extrato completo
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhuma transação recente.
              </p>
            ) : (
              <div className="flex flex-col">
                {recentTransactions.map((t) => {
                  const cat = categoryMap.get(t.categoryId);
                  const acc = accountMap.get(t.accountId);
                  const isReceita = t.tipo === 'RECEITA';

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border-b border-border py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon
                          name={cat?.nome}
                          icon={cat?.icone}
                          color={cat?.cor}
                          size={18}
                          className="size-10 rounded-2xl"
                        />
                        <div className="flex flex-col truncate">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {t.descricao}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {cat?.nome ?? 'Geral'} · {acc?.nome ?? 'Conta'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'text-sm font-bold tabular-nums shrink-0 ml-2',
                          isReceita ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {isReceita ? '+' : '-'} {formatMoney(t.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fatura por Cartão Widget */}
          <div className="rounded-3xl border border-border bg-card p-5 md:col-span-1 h-full">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Cartões de crédito
              </span>
              <Link
                to="/cartoes"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Detalhes <IconChevronRight size={14} />
              </Link>
            </div>

            {dashboard.faturaAtualPorCartao.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhum cartão com fatura aberta este mês.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dashboard.faturaAtualPorCartao.map((cartao) => (
                  <Link
                    key={cartao.accountId}
                    to="/cartoes"
                    className="flex items-center justify-between rounded-xl bg-foreground/[0.03] p-3.5 border border-border hover:bg-foreground/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <IconCreditCard size={20} />
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {cartao.nome}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground tabular-nums">
                      {formatMoney(cartao.total)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
