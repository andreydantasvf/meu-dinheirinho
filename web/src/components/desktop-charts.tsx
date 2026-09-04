import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatMoney } from '@/lib/money';
import type { Transaction } from '@/types/entities';

export function ExpenseTypeChart({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const chartData = useMemo(() => {
    let unica = 0;
    let parcelada = 0;
    let fixa = 0;

    for (const t of transactions) {
      if (t.tipo === 'DESPESA') {
        const val = Number(t.valor);
        if (t.purchaseId) parcelada += val;
        else if (t.fixedExpenseId) fixa += val;
        else unica += val;
      }
    }

    return [
      { name: 'Avulsa', value: unica, fill: 'var(--chart-1)' },
      { name: 'Parcelada', value: parcelada, fill: 'var(--chart-2)' },
      { name: 'Fixa/Assinatura', value: fixa, fill: 'var(--chart-3)' },
    ].filter((d) => d.value > 0);
  }, [transactions]);

  const chartConfig = {
    value: { label: 'Valor' },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Sem dados de despesas
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => formatMoney(value as number)}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            strokeWidth={4}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: item.fill }}
            />
            <span className="truncate">
              {item.name}: {formatMoney(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardUsageChart({
  faturas,
}: {
  faturas: Array<{ nome: string; total: string }>;
}) {
  const chartData = useMemo(() => {
    return faturas
      .map((f, i) => ({
        nome: f.nome,
        total: Number(f.total),
        fill: `var(--chart-${(i % 5) + 1})`,
      }))
      .sort((a, b) => b.total - a.total);
  }, [faturas]);

  const chartConfig = {
    total: { label: 'Fatura' },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Nenhuma fatura aberta
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[250px]">
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" vertical={true} />
        <YAxis
          dataKey="nome"
          type="category"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={80}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--foreground)/0.05)' }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value) => formatMoney(value as number)}
            />
          }
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={32}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
