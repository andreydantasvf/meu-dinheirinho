import { cn } from '@/lib/utils';
import type { TransactionType } from '@/types/entities';

export function TransactionTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-2xl bg-foreground/5 p-1 border border-border">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('DESPESA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center disabled:pointer-events-none disabled:opacity-50',
          value === 'DESPESA'
            ? 'bg-primary text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Saída (Despesa)
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('RECEITA')}
        className={cn(
          'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all text-center disabled:pointer-events-none disabled:opacity-50',
          value === 'RECEITA'
            ? 'bg-success text-success-foreground shadow-[0_0_16px_rgba(34,211,160,0.3)]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Entrada (Receita)
      </button>
    </div>
  );
}
