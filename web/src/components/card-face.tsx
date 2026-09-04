import { useState } from 'react';
import {
  IconCalendar,
  IconInfoCircle,
  IconPencil,
  IconRotate,
  IconRss,
  IconTrash,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFatura } from '@/hooks/use-fatura';
import { formatMoney } from '@/lib/money';
import { getCardTheme } from '@/lib/card-colors';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/entities';

export function CardFace({
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
                {account.diaVencimento
                  ? `· Vence dia ${account.diaVencimento}`
                  : ''}
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
                      <span className="text-sm font-bold text-zinc-400">
                        R$
                      </span>
                      <span className="text-2xl font-black tracking-tight text-white tabular-nums">
                        {formatMoney(fatura.faturaAtual)
                          .replace('R$', '')
                          .trim()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-zinc-400 block">
                      Disponível
                    </span>
                    <span className="text-xs font-extrabold text-zinc-200 tabular-nums">
                      R${' '}
                      {formatMoney(fatura.limiteDisponivel)
                        .replace('R$', '')
                        .trim()}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      theme.progressBar,
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>•••• •••• •••• {cardLastDigits}</span>
                <span>
                  Limite R$ {formatMoney(limite).replace('R$', '').trim()}
                </span>
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
                <span className="font-mono text-xs font-black text-amber-400">
                  CVV 842
                </span>
              </div>
            </div>

            {/* Billing Details */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-2.5 border border-white/5 text-xs text-zinc-300">
              <div className="flex items-center gap-1.5">
                <IconCalendar size={14} className={theme.accent} />
                <span className="text-[11px]">
                  Fecha:{' '}
                  <strong className="text-white">
                    {account.diaFechamento || 'N/A'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconInfoCircle size={14} className={theme.accent} />
                <span className="text-[11px]">
                  Vence:{' '}
                  <strong className="text-white">
                    {account.diaVencimento || 'N/A'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Flip Back Button */}
          <div
            className="relative z-10 flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
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
