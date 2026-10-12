import type { ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useCloseModal } from '@/hooks/use-close-modal';

export function ModalRoute({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const closeModal = useCloseModal();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground shadow-2xl pt-[calc(0.75rem+env(safe-area-inset-top))] md:items-center md:justify-center md:bg-black/50 md:p-4 md:pt-4">
      <div className="mx-auto flex w-full max-w-md flex-col bg-background md:rounded-2xl md:max-h-[90vh] md:overflow-hidden md:shadow-2xl h-full md:h-auto">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={closeModal}
            aria-label="Fechar"
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

// Rodapé do formulário de uma rota modal: fica grudado no fim da área rolável,
// então o botão de salvar aparece sem precisar rolar até o fim do formulário.
// `-mx-5 -mb-5 -bottom-5` anulam o padding do conteúdo do ModalRoute (o sticky
// conta a partir da borda de padding do container rolável).
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-4 border-t border-border bg-background/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:pb-5">
      {children}
    </div>
  );
}
