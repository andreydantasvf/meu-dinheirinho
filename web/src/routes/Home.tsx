import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export default function Home() {
  const { data: dashboard, isLoading, isError } = useDashboard();

  const gastoPorCategoria = dashboard?.gastoPorCategoria ?? [];
  const chartData = gastoPorCategoria.map((item, index) => ({
    categoriaId: item.categoriaId,
    nome: item.nome,
    total: Number(item.total),
    fill: chartColors[index % chartColors.length],
  }));
  const chartConfig: ChartConfig = Object.fromEntries(
    chartData.map((item) => [
      item.categoriaId,
      { label: item.nome, color: item.fill },
    ]),
  );

  const saldoMes = dashboard ? Number(dashboard.saldoMes) : 0;

  return (
    <div className="p-4 pb-24">
      <div className="mb-4 flex gap-2">
        <Button asChild className="flex-1">
          <Link to="/transacoes/nova">
            <Plus /> Nova transação
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to="/compras/nova">
            <ShoppingBag /> Compra parcelada
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o painel.
        </p>
      )}

      {dashboard && (
        <>
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Saldo do mês</p>
            <p
              className={cn(
                'text-2xl font-semibold',
                saldoMes >= 0 ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {formatMoney(dashboard.saldoMes)}
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Gastos por categoria
            </p>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum gasto registrado neste mês.
              </p>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square max-h-64"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent nameKey="categoriaId" hideLabel />
                    }
                  />
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="categoriaId"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.categoriaId} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Fatura atual por cartão
            </p>
            {dashboard.faturaAtualPorCartao.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cartão com fatura este mês.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dashboard.faturaAtualPorCartao.map((cartao) => (
                  <li
                    key={cartao.accountId}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      to="/cartoes"
                      className="text-foreground hover:underline"
                    >
                      {cartao.nome}
                    </Link>
                    <span className="font-medium">
                      {formatMoney(cartao.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
