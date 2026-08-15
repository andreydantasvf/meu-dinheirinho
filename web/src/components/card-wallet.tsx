import { useEffect, useState } from 'react';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { useFatura } from '@/hooks/use-fatura';
import { formatMoney } from '@/lib/money';
import type { Account } from '@/types/entities';

export function CardWallet({
  cards,
  onEdit,
  onDelete,
  onFocusChange,
}: {
  cards: Account[];
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onFocusChange: (accountId: string | undefined) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) {
      onFocusChange(cards[0]?.id);
      return;
    }

    function handleSelect() {
      const index = api!.selectedScrollSnap();
      onFocusChange(cards[index]?.id);
    }

    handleSelect();
    api.on('select', handleSelect);
    api.on('reInit', handleSelect);

    return () => {
      api.off('select', handleSelect);
      api.off('reInit', handleSelect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cards]);

  return (
    <Carousel setApi={setApi} opts={{ align: 'start', containScroll: 'trimSnaps' }}>
      <CarouselContent>
        {cards.map((account) => (
          <CarouselItem key={account.id} className="basis-[85%] pl-3">
            <CardFace
              account={account}
              onEdit={() => onEdit(account)}
              onDelete={() => onDelete(account)}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

function CardFace({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: fatura, isLoading } = useFatura(account.id);
  const limite = Number(account.limite ?? 0);
  const disponivel = fatura ? Number(fatura.limiteDisponivel) : limite;
  const usedPct =
    limite > 0 ? Math.min(100, Math.max(0, ((limite - disponivel) / limite) * 100)) : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-secondary to-popover p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-bold text-foreground tracking-tight">
            {account.nome}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {account.diaFechamento ? `Fecha dia ${account.diaFechamento}` : 'Fatura aberta'}{' '}
            {account.diaVencimento ? `· Vence dia ${account.diaVencimento}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
            ABERTA
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="size-7 rounded-lg text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <IconPencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <IconTrash size={14} />
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="my-4 h-16 w-full rounded-2xl bg-foreground/5" />}

      {fatura && (
        <>
          <div className="my-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Fatura Atual
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold text-muted-foreground">R$</span>
              <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {formatMoney(fatura.faturaAtual).replace('R$', '').trim()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_16px_rgba(0,200,255,0.5)] transition-all duration-500"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>Limite utilizado</span>
              <span className="font-bold text-foreground tabular-nums">
                R$ {formatMoney(fatura.limiteDisponivel).replace('R$', '').trim()} disponível
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
