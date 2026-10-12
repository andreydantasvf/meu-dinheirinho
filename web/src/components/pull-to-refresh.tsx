import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowDown, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';

// Distância (já com resistência) para disparar o refresh, e o máximo que o
// indicador desce.
const THRESHOLD = 64;
const MAX_PULL = 96;
const RESISTANCE = 0.5;
// Movimento mínimo antes de decidir se o gesto é vertical (pull) ou horizontal
// (ex. arrastar a carteira de cartões) — horizontal cancela o pull.
const DIRECTION_SLOP = 8;
const MIN_SPINNER_MS = 500;
const REFRESH_TIMEOUT_MS = 10_000;

// Gestos que começam dentro de dialogs, selects e menus abertos não são pull.
const IGNORE_SELECTOR =
  '[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"],[data-radix-popper-content-wrapper]';

type Phase = 'idle' | 'pulling' | 'refreshing';

// Puxar para atualizar nas telas de aba. O PWA instalado no iOS (standalone)
// não tem o gesto nativo do Safari, e o index.css desliga o overscroll da página
// (`overscroll-behavior-y: none`), então o gesto é implementado aqui: com a
// página no topo, arrastar para baixo e soltar além de THRESHOLD refaz as
// queries ativas. A distância é aplicada direto no DOM (ref), não em estado, para
// acompanhar o dedo sem re-renderizar a tela a cada touchmove.
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let decided = false;
    let distance = 0;

    function setPhaseBoth(next: Phase) {
      phaseRef.current = next;
      setPhase(next);
    }

    function render(pull: number, animate: boolean) {
      const indicator = indicatorRef.current;
      if (!indicator) return;
      indicator.style.transition = animate
        ? 'transform 200ms ease, opacity 200ms ease'
        : 'none';
      indicator.style.transform = `translateY(${pull - 48}px)`;
      indicator.style.opacity = String(Math.min(pull / THRESHOLD, 1));
      // Seta vira para cima quando soltar já vai atualizar. Durante o refresh o
      // spinner substitui a seta e o ref fica nulo.
      if (iconRef.current) {
        iconRef.current.style.transform = `rotate(${pull >= THRESHOLD ? 180 : 0}deg)`;
      }
    }

    function reset() {
      tracking = false;
      decided = false;
      distance = 0;
      render(0, true);
    }

    function onTouchStart(event: TouchEvent) {
      if (phaseRef.current === 'refreshing' || event.touches.length !== 1) {
        return;
      }
      const target = event.target as Element | null;
      if (
        window.scrollY > 0 ||
        document.body.hasAttribute('data-scroll-locked') ||
        target?.closest(IGNORE_SELECTOR)
      ) {
        return;
      }
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
      decided = false;
      distance = 0;
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < DIRECTION_SLOP && Math.abs(dy) < DIRECTION_SLOP) {
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) || dy < 0 || window.scrollY > 0) {
          tracking = false;
          return;
        }
        decided = true;
        setPhaseBoth('pulling');
      }

      distance = Math.min(Math.max(dy, 0) * RESISTANCE, MAX_PULL);
      render(distance, false);
    }

    async function onTouchEnd() {
      if (!tracking) return;
      const shouldRefresh = decided && distance >= THRESHOLD;
      tracking = false;
      decided = false;

      if (!shouldRefresh) {
        setPhaseBoth('idle');
        reset();
        return;
      }

      if (!navigator.onLine) {
        // Offline as queries ficam pausadas e o refetch não terminaria.
        toast.warning('Sem conexão', {
          description: 'Mostrando os dados salvos no aparelho.',
        });
        setPhaseBoth('idle');
        reset();
        return;
      }

      setPhaseBoth('refreshing');
      render(THRESHOLD, true);
      const started = Date.now();
      try {
        await Promise.race([
          queryClient.refetchQueries({ type: 'active' }),
          new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
        ]);
      } finally {
        const elapsed = Date.now() - started;
        if (elapsed < MIN_SPINNER_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_SPINNER_MS - elapsed),
          );
        }
        setPhaseBoth('idle');
        reset();
      }
    }

    function onTouchCancel() {
      if (phaseRef.current === 'refreshing') return;
      setPhaseBoth('idle');
      reset();
    }

    // Passivos: o pull nunca chama preventDefault — no topo da página não há
    // rolagem nativa para disputar, porque o overscroll está desligado.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [queryClient]);

  return (
    <div className="pointer-events-none relative z-20 h-0 md:hidden">
      <div
        ref={indicatorRef}
        role="status"
        aria-label={phase === 'refreshing' ? 'Atualizando' : undefined}
        className="absolute inset-x-0 top-0 flex justify-center opacity-0"
        style={{ transform: 'translateY(-48px)' }}
      >
        <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg">
          {phase === 'refreshing' ? (
            <IconLoader2 size={20} className="animate-spin" />
          ) : (
            <div ref={iconRef} className="transition-transform duration-150">
              <IconArrowDown size={20} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
