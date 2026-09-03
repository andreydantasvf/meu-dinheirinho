import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { CardFace } from '@/components/card-face';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/entities';

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

  const safeIndex = cards.length > 0 ? Math.min(activeIndex, cards.length - 1) : 0;

  // Sync focused card when activeIndex changes or cards list changes
  useEffect(() => {
    if (cards.length === 0) {
      onFocusChange(undefined);
      return;
    }
    onFocusChange(cards[safeIndex]?.id);
  }, [safeIndex, cards, onFocusChange]);

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


