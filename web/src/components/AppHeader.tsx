import { useLocation } from 'react-router-dom';
import { ThemeQuickToggle } from '@/components/theme-quick-toggle';

const titles: Record<string, string> = {
  '/': 'Meu Dinheirinho',
  '/extrato': 'Extrato',
  '/cartoes': 'Cartões',
  '/categorias': 'Categorias',
};

export function AppHeader() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? 'Meu Dinheirinho';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-card to-background border border-primary/30 shadow-[0_0_12px_rgba(0,200,255,0.2)] text-xs font-black text-primary">
          MD
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>

      <ThemeQuickToggle />
    </header>
  );
}
