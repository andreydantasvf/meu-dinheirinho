import { Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';

const titles: Record<string, string> = {
  '/': 'Início',
  '/extrato': 'Extrato',
  '/cartoes': 'Cartões',
  '/categorias': 'Categorias',
};

export function AppHeader() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? 'Meu Dinheirinho';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
      <h1 className="py-3 text-lg font-semibold">{title}</h1>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Configurações">
            <Settings />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Preferências</SheetTitle>
            <SheetDescription>Aparência do aplicativo.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
