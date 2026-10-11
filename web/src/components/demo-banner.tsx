import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function DemoBanner() {
  const [confirming, setConfirming] = useState(false);

  async function reset() {
    // MODE inline (não IS_DEMO) para o bundler eliminar este import() fora da demo.
    if (import.meta.env.MODE !== 'demo') return;
    const { resetDemo } = await import('@/demo/store');
    resetDemo();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs text-foreground">
      <p>
        <span className="font-semibold">Modo demo</span> · dados fictícios
        salvos só neste navegador
      </p>
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Resetar dados
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar a demo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tudo o que você criou ou editou será descartado e os dados de
              exemplo voltam ao estado inicial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Resetar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
