import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Início', end: true },
  { to: '/extrato', label: 'Extrato', end: false },
  { to: '/cartoes', label: 'Cartões', end: false },
  { to: '/categorias', label: 'Categorias', end: false },
];

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'flex-1 py-3 text-center text-sm',
              isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
