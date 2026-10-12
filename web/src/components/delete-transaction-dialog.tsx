import { toast } from 'sonner';
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
import { useDeleteTransaction } from '@/hooks/use-transactions';
import { useDeletePurchase } from '@/hooks/use-purchases';
import { useDeleteFixedExpense } from '@/hooks/use-fixed-expenses';
import { ApiError } from '@/lib/api';
import type { Transaction } from '@/types/entities';

const destructiveAction =
  'bg-destructive font-bold text-white hover:bg-destructive/90';

// Excluir a partir de uma linha do extrato/fatura tem três efeitos diferentes, e o
// texto precisa dizer qual: parcela apaga a compra inteira (a API não deixa apagar
// uma parcela solta); lançamento recorrente pode sair sozinho ou cancelar a
// recorrência; o resto é uma transação avulsa.
export function DeleteTransactionDialog({
  transaction,
  onClose,
}: {
  transaction: Transaction | undefined;
  onClose: () => void;
}) {
  const deleteTransaction = useDeleteTransaction();
  const deletePurchase = useDeletePurchase();
  const deleteFixedExpense = useDeleteFixedExpense();

  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      onClose();
    }
  }

  function deleteSingle(id: string) {
    return run(
      () => deleteTransaction.mutateAsync({ id }),
      'Transação excluída com sucesso',
    );
  }

  return (
    <AlertDialog
      open={Boolean(transaction)}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent className="max-w-sm">
        {transaction?.purchaseId ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir compra parcelada?</AlertDialogTitle>
              <AlertDialogDescription>
                A compra "{transaction.descricao}" e todas as suas{' '}
                {transaction.parcelaTotal} parcelas serão excluídas
                permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(
                    () =>
                      deletePurchase.mutateAsync({
                        id: transaction.purchaseId!,
                      }),
                    'Compra parcelada excluída com sucesso',
                  )
                }
                className={destructiveAction}
              >
                Excluir compra
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : transaction?.fixedExpenseId ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Excluir lançamento recorrente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                "{transaction.descricao}" se repete todo mês. Você pode excluir
                só este lançamento ou cancelar a recorrência, que remove os
                lançamentos de hoje em diante e desativa os lembretes ligados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                onClick={() => deleteSingle(transaction.id)}
              >
                Só este lançamento
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() =>
                  run(
                    () =>
                      deleteFixedExpense.mutateAsync({
                        id: transaction.fixedExpenseId!,
                      }),
                    'Recorrência cancelada com sucesso',
                  )
                }
                className={destructiveAction}
              >
                Cancelar recorrência
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
              <AlertDialogDescription>
                A transação "{transaction?.descricao}" será removida
                permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => transaction && deleteSingle(transaction.id)}
                className={destructiveAction}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
