import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconPencil,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconRss,
  IconCalendar,
  IconInfoCircle,
  IconRotate,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFatura } from '@/hooks/use-fatura';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/entities';
import { getCardTheme } from '@/lib/card-colors';

const SWIPE_THRESHOLD = 75; // px needed to swap card
const VELOCITY_THRESHOLD = 0.35; // px/ms needed for fling

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dismissingDir, setDismissingDir] = useState<number | null>(null);
  const [, setColorTick] = useState(0);

  const dragStartRef = useRef<{ x: number; y: number; time: number }>({
    x: 0,
    y: 0,
    time: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen to color changes from AccountFormDialog
  useEffect(() => {
    const handleColorChange = () => setColorTick((t) => t + 1);
    window.addEventListener('card-colors-changed', handleColorChange);
    return () => window.removeEventListener('card-colors-changed', handleColorChange);
  }, []);

  // Sync focused card when activeIndex changes or cards list changes
  useEffect(() => {
    if (cards.length === 0) {
      onFocusChange(undefined);
      return;
    }
    const safeIndex = Math.min(activeIndex, cards.length - 1);
    if (safeIndex !== activeIndex) {
      setActiveIndex(safeIndex);
    }
    onFocusChange(cards[safeIndex]?.id);
  }, [activeIndex, cards, onFocusChange]);

  const handleNext = useCallback(() => {
    if (cards.length <= 1) return;
    setDismissingDir(-1);
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % cards.length);
      setDismissingDir(null);
      setDragOffset({ x: 0, y: 0 });
    }, 220);
  }, [cards.length]);

  const handlePrev = useCallback(() => {
    if (cards.length <= 1) return;
    setDismissingDir(1);
    setTimeout(() => {
      setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
      setDismissingDir(null);
      setDragOffset({ x: 0, y: 0 });
    }, 220);
  }, [cards.length]);

  // Pointer event handlers for gesture-driven card dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If user pressed a button, do not capture pointer or start card drag
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) {
      return;
    }

    if (cards.length <= 1 || dismissingDir !== null) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture lost
    }

    const deltaX = dragOffset.x;
    const deltaTime = Math.max(1, Date.now() - dragStartRef.current.time);
    const velocityX = Math.abs(deltaX) / deltaTime;

    if (
      Math.abs(deltaX) > SWIPE_THRESHOLD ||
      velocityX > VELOCITY_THRESHOLD
    ) {
      // Trigger card swap!
      const dir = deltaX > 0 ? 1 : -1;
      setDismissingDir(dir);
      setTimeout(() => {
        if (dir < 0) {
          setActiveIndex((prev) => (prev + 1) % cards.length);
        } else {
          setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
        }
        setDismissingDir(null);
        setDragOffset({ x: 0, y: 0 });
      }, 200);
    } else {
      // Snap back to center
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  if (cards.length === 0) return null;

  const dragProgress = Math.min(Math.abs(dragOffset.x) / 160, 1);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* 3D Stack Container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-md h-[240px] flex items-center justify-center touch-pan-y"
        style={{ perspective: '1200px' }}
      >
        {cards.map((account, index) => {
          // Calculate stack distance relative to active card
          const stackOffset =
            (index - activeIndex + cards.length) % cards.length;

          // We only render cards up to depth 3 to optimize rendering
          if (stackOffset > 2 && cards.length > 3) return null;

          const isTopCard = stackOffset === 0;

          // Compute stack transformations
          let translateX = 0;
          let translateY = 0;
          let scale = 1;
          let opacity = 1;
          let rotation = 0;
          let zIndex = 30 - stackOffset * 10;

          if (isTopCard) {
            if (dismissingDir !== null) {
              translateX = dismissingDir * 380;
              rotation = dismissingDir * 24;
              opacity = 0;
            } else {
              translateX = dragOffset.x;
              translateY = dragOffset.y * 0.25;
              rotation = dragOffset.x * 0.05;
            }
          } else if (stackOffset === 1) {
            // Card stacked immediately behind: moves forward smoothly as top card is dragged
            translateY = 16 - dragProgress * 16;
            scale = 0.94 + dragProgress * 0.06;
            opacity = 0.88 + dragProgress * 0.12;
            zIndex = 20;
          } else if (stackOffset === 2) {
            // Card 2 positions behind
            translateY = 32 - dragProgress * 16;
            scale = 0.88 + dragProgress * 0.06;
            opacity = 0.65 + dragProgress * 0.23;
            zIndex = 10;
          }

          return (
            <div
              key={account.id}
              onPointerDown={isTopCard ? handlePointerDown : undefined}
              onPointerMove={isTopCard ? handlePointerMove : undefined}
              onPointerUp={isTopCard ? handlePointerUp : undefined}
              onPointerCancel={isTopCard ? handlePointerUp : undefined}
              onClick={() => {
                if (!isTopCard && !isDragging) {
                  setActiveIndex(index);
                }
              }}
              style={{
                transform: `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scale}) rotate(${rotation}deg)`,
                opacity,
                zIndex,
                transition: isDragging
                  ? isTopCard
                    ? 'none'
                    : 'transform 0.1s ease-out, opacity 0.1s ease-out'
                  : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease-out',
              }}
              className={cn(
                'absolute inset-x-0 mx-auto w-full cursor-grab active:cursor-grabbing will-change-transform',
                !isTopCard && 'cursor-pointer',
              )}
            >
              <CardFace
                account={account}
                onEdit={() => onEdit(account)}
                onDelete={() => onDelete(account)}
              />
            </div>
          );
        })}
      </div>

      {/* Swipe Gesture Instruction & Pagination Controls */}
      <div className="flex w-full max-w-md items-center justify-between px-2 pt-2">
        <Button
          variant="ghost"
          size="icon"
          disabled={cards.length <= 1}
          onClick={handlePrev}
          className="size-8 rounded-full text-muted-foreground hover:bg-foreground/10"
          aria-label="Cartão anterior"
        >
          <IconChevronLeft size={18} />
        </Button>

        {/* Dynamic Pagination Pill */}
        {cards.length > 1 && (
          <div className="flex items-center gap-1.5 bg-foreground/5 px-3 py-1.5 rounded-full border border-border/40">
            {cards.map((account, index) => (
              <button
                key={account.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === activeIndex
                    ? 'w-5 bg-primary shadow-[0_0_8px_rgba(0,200,255,0.6)]'
                    : 'w-1.5 bg-foreground/30 hover:bg-foreground/50',
                )}
                aria-label={`Ir para cartão ${index + 1}`}
              />
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          disabled={cards.length <= 1}
          onClick={handleNext}
          className="size-8 rounded-full text-muted-foreground hover:bg-foreground/10"
          aria-label="Próximo cartão"
        >
          <IconChevronRight size={18} />
        </Button>
      </div>
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
  const [isFlipped, setIsFlipped] = useState(false);
  const { data: fatura, isLoading } = useFatura(account.id);
  const theme = getCardTheme(account.id, account.nome);

  const limite = Number(account.limite ?? 0);
  const disponivel = fatura ? Number(fatura.limiteDisponivel) : limite;
  const usedPct =
    limite > 0
      ? Math.min(100, Math.max(0, ((limite - disponivel) / limite) * 100))
      : 0;

  const cardLastDigits = account.id.slice(-4).toUpperCase();

  return (
    <div
      className="relative w-full h-[220px] rounded-3xl"
      style={{ perspective: '1000px' }}
    >
      <div
        className={cn(
          'relative w-full h-full rounded-3xl transition-transform duration-500',
          theme.glow,
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ==================== CARD FRONT ==================== */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-between rounded-3xl border p-5 overflow-hidden backdrop-blur-md',
            theme.bg,
            theme.border,
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Decorative Overlay Spheres */}
          <div
            className={cn(
              'absolute -top-12 -right-12 size-40 rounded-full blur-2xl pointer-events-none',
              theme.circleRight,
            )}
          />
          <div
            className={cn(
              'absolute -bottom-12 -left-12 size-40 rounded-full blur-2xl pointer-events-none',
              theme.circleLeft,
            )}
          />

          {/* Header Row */}
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-black tracking-tight text-white drop-shadow-sm">
                {account.nome}
              </span>
              <span className="text-[11px] font-medium text-zinc-400">
                {account.diaFechamento
                  ? `Fecha dia ${account.diaFechamento}`
                  : 'Fatura aberta'}{' '}
                {account.diaVencimento ? `· Vence dia ${account.diaVencimento}` : ''}
              </span>
            </div>

            {/* Action Buttons: Edit & Delete */}
            <div
              className="flex items-center gap-1 relative z-20"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Editar conta/cartão"
                className="size-8 rounded-xl text-zinc-400 hover:bg-white/15 hover:text-white"
              >
                <IconPencil size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Excluir conta/cartão"
                className="size-8 rounded-xl text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400"
              >
                <IconTrash size={16} />
              </Button>
            </div>
          </div>

          {/* Middle Row: EMV Chip & Contactless & Card Number Mask */}
          <div className="relative z-10 my-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Gold EMV Chip Simulation */}
              <div
                className={cn(
                  'h-7 w-9 rounded-md bg-gradient-to-r border border-amber-300/40 p-1 flex flex-col justify-between shadow-inner',
                  theme.chip,
                )}
              >
                <div className="h-full w-full rounded-[2px] border border-amber-900/30 bg-amber-400/20" />
              </div>
              {/* Contactless Icon */}
              <IconRss size={18} className="text-zinc-400 rotate-90" />
            </div>

            {/* Card Brand Circles Emblem */}
            <div className="flex items-center -space-x-2">
              <div className="size-6 rounded-full bg-rose-500/80 backdrop-blur-sm shadow-sm" />
              <div className="size-6 rounded-full bg-amber-400/80 backdrop-blur-sm shadow-sm" />
            </div>
          </div>

          {/* Bottom Row: Balance & Limit Meter */}
          <div className="relative z-10 flex flex-col gap-2">
            {isLoading ? (
              <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
            ) : fatura ? (
              <>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Fatura Atual
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-zinc-400">R$</span>
                      <span className="text-2xl font-black tracking-tight text-white tabular-nums">
                        {formatMoney(fatura.faturaAtual).replace('R$', '').trim()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-zinc-400 block">
                      Disponível
                    </span>
                    <span className="text-xs font-extrabold text-zinc-200 tabular-nums">
                      R$ {formatMoney(fatura.limiteDisponivel).replace('R$', '').trim()}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', theme.progressBar)}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>•••• •••• •••• {cardLastDigits}</span>
                <span>Limite R$ {formatMoney(limite).replace('R$', '').trim()}</span>
              </div>
            )}
          </div>
        </div>

        {/* ==================== CARD BACK ==================== */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-between rounded-3xl border overflow-hidden backdrop-blur-md p-5',
            theme.bg,
            theme.border,
          )}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Black Magnetic Stripe */}
          <div className="absolute top-4 inset-x-0 h-10 bg-zinc-950 border-y border-zinc-800/60 shadow-inner" />

          {/* Back Content Container */}
          <div className="mt-12 flex flex-col gap-3 relative z-10">
            {/* Signature & CVV Strip */}
            <div className="flex items-center gap-3">
              <div className="h-8 flex-1 bg-zinc-200/90 rounded-md p-1.5 flex items-center justify-end">
                <span className="font-mono text-xs font-bold text-zinc-800 tracking-widest italic">
                  AUTHORISED SIGNATURE
                </span>
              </div>
              <div className="h-8 w-14 bg-zinc-900 border border-zinc-700 rounded-md flex items-center justify-center">
                <span className="font-mono text-xs font-black text-amber-400">CVV 842</span>
              </div>
            </div>

            {/* Billing Details */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-2.5 border border-white/5 text-xs text-zinc-300">
              <div className="flex items-center gap-1.5">
                <IconCalendar size={14} className={theme.accent} />
                <span className="text-[11px]">
                  Fecha: <strong className="text-white">{account.diaFechamento || 'N/A'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconInfoCircle size={14} className={theme.accent} />
                <span className="text-[11px]">
                  Vence: <strong className="text-white">{account.diaVencimento || 'N/A'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Flip Back Button */}
          <div className="relative z-10 flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFlipped(false)}
              className="h-7 gap-1.5 rounded-full border-white/20 bg-black/40 text-[11px] font-bold text-white hover:bg-white/20"
            >
              <IconRotate size={13} /> Voltar Frente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
