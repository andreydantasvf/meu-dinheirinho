import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ModalRoute({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          Fechar
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
