import { useCallback, useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { Account } from '@/types/entities';

const MAX_PEEK = 2;
const SCALE_STEP = 0.035;
const TRANSLATE_Y_STEP = 16;
const OPACITY_STEP = 0.18;
const OPACITY_FLOOR = 0.35;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const applyStackTween = useCallback(() => {
    if (!api) return;
    const selectedIndex = api.selectedScrollSnap();
    const selectedNode = itemRefs.current[selectedIndex];
    if (!selectedNode) return;

    const selectedLeft = selectedNode.offsetLeft;
    const scrollProgress = api.scrollProgress();
    const snapList = api.scrollSnapList();
    // scrollProgress() and scrollSnapList() are both normalized to [0, 1]
    // across the *entire* scrollable range, so the gap between adjacent
    // snap points shrinks as more cards are added (e.g. 1/3 apart with 4
    // cards, 1/9 with 10). Rescale into card-index units — 1.0 == "one
    // card away" — so peek depth stays visually consistent no matter how
    // many cards are in the wallet.
    const totalSteps = snapList.length > 1 ? snapList.length - 1 : 1;
    const cardPosition = scrollProgress * totalSteps;

    snapList.forEach((_snapPoint, index) => {
      const node = itemRefs.current[index];
      if (!node) return;

      const diffToTarget = index - cardPosition;

      if (diffToTarget < -0.05 || diffToTarget > MAX_PEEK + 0.5) {
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
        node.inert = true;
        return;
      }

      const clamped = clamp(diffToTarget, 0, MAX_PEEK);
      const pullBack = node.offsetLeft - selectedLeft;
      // Peek is revealed purely via vertical offset + scale (cards stack
      // straight behind one another), not a horizontal nudge — the front
      // card is full-width (matching the sections below it), so there's no
      // reserved side margin for a rightward peek to sit in without being
      // clipped by the carousel viewport's overflow-hidden bounds.
      const translateX = -pullBack;
      const scale = 1 - clamped * SCALE_STEP;
      const translateY = clamped * TRANSLATE_Y_STEP;
      const opacity = Math.max(1 - clamped * OPACITY_STEP, OPACITY_FLOOR);
      const isFocused = clamped < 0.05;

      node.style.transform = `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`;
      node.style.opacity = String(opacity);
      node.style.zIndex = String(30 - Math.round(clamped * 10));
      node.style.pointerEvents = isFocused ? 'auto' : 'none';
      // Peeking/hidden cards stay mounted (for the tween) but must not be
      // keyboard-focusable: a focused descendant inside the overflow-hidden
      // carousel track makes the browser auto-scroll that container's native
      // scrollLeft to reveal it, which permanently desyncs from embla's own
      // transform-based positioning (embla assumes scrollLeft stays 0).
      node.inert = !isFocused;
    });
  }, [api]);

  useEffect(() => {
    if (!api) {
      onFocusChange(cards[0]?.id);
      return;
    }

    function handleSelect() {
      if (cards.length === 0) {
        onFocusChange(undefined);
        return;
      }
      // Clamp against the current `cards` length rather than trusting
      // embla's own index: when a card is deleted, this effect re-runs
      // synchronously on the next render (via the `cards` dependency)
      // before embla has resynced its internal snap list to the new,
      // shorter slide count — `selectedScrollSnap()` can still return an
      // out-of-range index, which previously left focus stuck on nothing
      // until a page reload.
      const index = Math.min(api!.selectedScrollSnap(), cards.length - 1);
      onFocusChange(cards[index]?.id);
      setSelectedIndex(index);
    }

    handleSelect();
    applyStackTween();
    api.on('select', handleSelect);
    api.on('select', applyStackTween);
    api.on('scroll', applyStackTween);
    api.on('reInit', handleSelect);
    api.on('reInit', applyStackTween);

    return () => {
      api.off('select', handleSelect);
      api.off('select', applyStackTween);
      api.off('scroll', applyStackTween);
      api.off('reInit', handleSelect);
      api.off('reInit', applyStackTween);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cards, applyStackTween]);

  return (
    <div>
      <Carousel setApi={setApi} opts={{ align: 'start', containScroll: 'trimSnaps' }}>
        <CarouselContent>
          {cards.map((account, index) => (
            <CarouselItem key={account.id} className="basis-full">
              <div
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                // The embla viewport (ui/carousel.tsx's overflow-hidden div)
                // auto-sizes to this item's natural, untransformed layout
                // height — a peeking card's translateY only shows if that
                // height reserves room for it. pb-9 pads every item (front
                // card included, since the row's auto-height is shared
                // across all items) so the deepest peek (MAX_PEEK *
                // TRANSLATE_Y_STEP = 32px) never gets clipped. Skipped
                // entirely with a single card, where no peek ever renders.
                className={cn('relative will-change-transform', cards.length > 1 && 'pb-9')}
              >
                <CardFace
                  account={account}
                  onEdit={() => onEdit(account)}
                  onDelete={() => onDelete(account)}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {cards.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {cards.map((account, index) => (
            <span
              key={account.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === selectedIndex ? 'w-4 bg-primary' : 'w-1.5 bg-foreground/20',
              )}
            />
          ))}
        </div>
      )}
    </div>
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
