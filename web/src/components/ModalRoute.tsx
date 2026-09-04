import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
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
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground shadow-2xl pt-[calc(0.75rem+env(safe-area-inset-top))] md:items-center md:justify-center md:bg-black/50 md:p-4 md:pt-4">
      <div className="mx-auto flex w-full max-w-md flex-col bg-background md:rounded-2xl md:max-h-[90vh] md:overflow-hidden md:shadow-2xl h-full md:h-auto">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="size-9 rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <IconX size={20} />
          </Button>
          <h1 className="text-base font-bold text-foreground tracking-tight">
            {title}
          </h1>
          <div className="size-9" />
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
