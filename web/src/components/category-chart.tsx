import { useMemo } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatMoney } from '@/lib/money';
import type { Category } from '@/types/entities';

interface CategoryChartProps {
  data: Array<{ categoriaId: string; nome: string; total: string }>;
  categories: Category[];
}

export function CategoryChart({ data, categories }: CategoryChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => Number(d.total) > 0)
      .map((item) => {
        const cat = categories.find((c) => c.id === item.categoriaId);
        return {
          id: item.categoriaId || 'sem-categoria',
          name: item.nome,
          value: Number(item.total),
          fill: cat?.cor || 'var(--chart-1)',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data, categories]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: 'Valor' },
    };
    chartData.forEach((item) => {
      config[item.id] = {
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        Nenhum dado para exibir.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[250px] w-full"
      >
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
            innerRadius={60}
            strokeWidth={5}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <div
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: item.fill }}
            />
            <span className="truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
