import { IconLock, IconTrash, IconRepeat, IconUser } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category-icon';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Account, Category, Transaction } from '@/types/entities';

export function TransactionRow({
  transaction,
  category,
  account,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLocked = Boolean(transaction.purchaseId);
  const isFixed = Boolean(transaction.fixedExpenseId);
  const isReceita = transaction.tipo === 'RECEITA';

  return (
    <div className="flex items-center gap-3 border-b border-border p-3.5 last:border-b-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-center gap-3 text-left min-w-0"
      >
        <CategoryIcon
          name={category?.nome}
          icon={category?.icone}
          color={category?.cor}
          size={18}
          className="size-10 rounded-2xl"
        />
        <div className="flex flex-1 flex-col truncate">
          <span className="truncate text-sm font-bold text-foreground">
            {transaction.descricao}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {category?.nome ?? 'Sem categoria'} · {account?.nome ?? 'Sem conta'}
          </span>
        </div>
      </button>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            'text-sm font-extrabold tabular-nums',
            isReceita
              ? 'text-success'
              : transaction.terceiro
                ? 'text-muted-foreground'
                : 'text-foreground',
          )}
        >
          {isReceita ? '+' : '-'} {formatMoney(transaction.valor)}
        </span>

        {isLocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <IconLock size={10} />
            {transaction.parcelaNumero}/{transaction.parcelaTotal}
          </span>
        )}

        {transaction.terceiro && (
          <span className="inline-flex max-w-28 items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <IconUser size={10} className="shrink-0" />
            <span className="truncate">{transaction.terceiro}</span>
          </span>
        )}

        {isFixed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <IconRepeat size={10} />
            {account?.tipo === 'CARTAO_CREDITO' ? 'Assinatura' : 'Fixo'}
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Excluir transação"
        onClick={onDelete}
        className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
      >
        <IconTrash size={16} />
      </Button>
    </div>
  );
}
