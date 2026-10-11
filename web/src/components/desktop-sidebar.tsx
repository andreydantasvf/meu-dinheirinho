import { NavLink } from 'react-router-dom';
import {
  IconHome,
  IconReceipt,
  IconCreditCard,
  IconTag,
  IconBell,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { ThemeQuickToggle } from '@/components/theme-quick-toggle';

export function DesktopSidebar() {
  const tabs = [
    { to: '/', label: 'Início', icon: IconHome, end: true },
    { to: '/extrato', label: 'Extrato', icon: IconReceipt, end: false },
    { to: '/cartoes', label: 'Cartões', icon: IconCreditCard, end: false },
    { to: '/categorias', label: 'Categorias', icon: IconTag, end: false },
    { to: '/lembretes', label: 'Lembretes', icon: IconBell, end: false },
  ];

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar/50 backdrop-blur-xl px-4 py-6 justify-between h-dvh sticky top-0 shrink-0">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <img
            src="/logo.png"
            alt="Meu Dinheirinho Logo"
            className="size-8 object-contain drop-shadow-[0_0_8px_rgba(0,200,255,0.3)]"
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Dinheirinho
          </h1>
        </div>

        <nav className="flex flex-col gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,200,255,0.3)]'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                  )
                }
              >
                <Icon size={22} stroke={2} />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Tema
        </span>
        <ThemeQuickToggle />
      </div>
    </aside>
  );
}
