import { useLocation } from 'react-router-dom';
import { IconWifiOff } from '@tabler/icons-react';
import { ThemeQuickToggle } from '@/components/theme-quick-toggle';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/use-online-status';

const titles: Record<string, string> = {
  '/': 'Meu Dinheirinho',
  '/extrato': 'Extrato',
  '/cartoes': 'Cartões',
  '/categorias': 'Categorias',
};

export function AppHeader() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? 'Meu Dinheirinho';
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <img
          src="/logo.png"
          alt="Meu Dinheirinho Logo"
          className="size-8 object-contain drop-shadow-[0_0_8px_rgba(0,200,255,0.3)]"
        />
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {!isOnline && (
          <Badge variant="destructive">
            <IconWifiOff />
            Offline
          </Badge>
        )}
      </div>

      <ThemeQuickToggle />
    </header>
  );
}
