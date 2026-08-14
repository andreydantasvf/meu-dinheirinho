import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  IconHome,
  IconReceipt,
  IconCreditCard,
  IconTag,
  IconPlus,
  IconArrowUpRight,
  IconShoppingBag,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export function BottomTabBar() {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const navigate = useNavigate();

  const leftTabs = [
    { to: '/', label: 'Início', icon: IconHome, end: true },
    { to: '/extrato', label: 'Extrato', icon: IconReceipt, end: false },
  ];

  const rightTabs = [
    { to: '/cartoes', label: 'Cartões', icon: IconCreditCard, end: false },
    { to: '/categorias', label: 'Categorias', icon: IconTag, end: false },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-sidebar/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl max-w-md mx-auto">
        {leftTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 text-xs transition-all duration-200',
                  isActive
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon size={22} stroke={2} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}

        {/* FAB Central Button */}
        <div className="relative flex justify-center w-16">
          <button
            type="button"
            onClick={() => setActionMenuOpen(true)}
            aria-label="Adicionar lançamento"
            className="absolute -top-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_28px_rgba(0,200,255,0.45)] transition-transform active:scale-95 hover:scale-105"
          >
            <IconPlus size={26} stroke={2.8} />
          </button>
        </div>

        {rightTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 text-xs transition-all duration-200',
                  isActive
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon size={22} stroke={2} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Quick Action Sheet */}
      <Sheet open={actionMenuOpen} onOpenChange={setActionMenuOpen}>
        <SheetContent side="bottom" className="p-5 max-w-md mx-auto rounded-t-3xl">
          <SheetHeader className="p-0 mb-4">
            <SheetTitle className="text-center text-lg font-bold">
              Novo Lançamento
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 pb-4">
            <Button
              className="h-14 justify-start gap-4 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base shadow-[0_0_20px_rgba(0,200,255,0.3)]"
              onClick={() => {
                setActionMenuOpen(false);
                navigate('/transacoes/nova');
              }}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
                <IconArrowUpRight size={20} stroke={2.5} />
              </span>
              Nova Transação (Receita/Despesa)
            </Button>
            <Button
              variant="outline"
              className="h-14 justify-start gap-4 rounded-2xl border-border bg-card text-foreground hover:bg-foreground/10 font-semibold text-base"
              onClick={() => {
                setActionMenuOpen(false);
                navigate('/compras/nova');
              }}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/10 text-primary">
                <IconShoppingBag size={20} stroke={2.5} />
              </span>
              Nova Compra Parcelada
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
