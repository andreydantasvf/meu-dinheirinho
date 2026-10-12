import { useParams } from 'react-router-dom';
import { useTransaction } from '@/hooks/use-transactions';
import { TransactionForm } from '@/components/transaction-form';
import { EditRouteGate } from '@/components/edit-route-gate';

export default function NovaTransacao() {
  const { id } = useParams();
  const transactionQuery = useTransaction(id);

  if (!id) {
    return (
      <TransactionForm
        transaction={undefined}
        isEditing={false}
        id={undefined}
      />
    );
  }

  return (
    <EditRouteGate
      title="Transação"
      notFoundMessage="Transação não encontrada. Ela pode ter sido excluída."
      query={transactionQuery}
    >
      {(transaction) => (
        <TransactionForm key={id} transaction={transaction} isEditing id={id} />
      )}
    </EditRouteGate>
  );
}
