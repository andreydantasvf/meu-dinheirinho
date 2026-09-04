import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconArrowUpRight, IconShoppingBag } from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DesktopFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="hidden md:block fixed bottom-8 right-8 z-50">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_28px_rgba(0,200,255,0.45)] transition-transform hover:scale-105 active:scale-95"
            aria-label="Novo lançamento"
          >
            <IconPlus size={26} stroke={2.8} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={16}
          className="w-64 rounded-2xl p-2 shadow-2xl"
        >
          <DropdownMenuItem
            onClick={() => navigate('/transacoes/nova')}
            className="flex cursor-pointer items-center gap-3 rounded-xl p-3 font-semibold text-foreground hover:bg-foreground/5 focus:bg-foreground/5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <IconArrowUpRight size={20} stroke={2.5} />
            </span>
            Nova Transação
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate('/compras/nova')}
            className="flex cursor-pointer items-center gap-3 rounded-xl p-3 font-semibold text-foreground hover:bg-foreground/5 focus:bg-foreground/5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/10 text-primary">
              <IconShoppingBag size={20} stroke={2.5} />
            </span>
            Compra Parcelada
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
