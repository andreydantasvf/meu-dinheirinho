import { useController } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { cn } from '@/lib/utils';

export function TransactionTypeToggle<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) {
  const { field } = useController({ control, name });

  return (
    <div className="flex rounded-2xl bg-foreground/5 p-1 border border-border">
      <button
        type="button"
        onClick={() => field.onChange('DESPESA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center',
          field.value === 'DESPESA'
            ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Saída (Despesa)
      </button>
      <button
        type="button"
        onClick={() => field.onChange('RECEITA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center',
          field.value === 'RECEITA'
            ? 'bg-success text-success-foreground shadow-[0_0_16px_rgba(34,211,160,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Entrada (Receita)
      </button>
    </div>
  );
}
