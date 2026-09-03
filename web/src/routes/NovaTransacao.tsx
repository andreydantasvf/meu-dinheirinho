import { useParams } from 'react-router-dom';
import { ModalRoute } from '../components/ModalRoute';
import { useTransaction } from '@/hooks/use-transactions';
import { TransactionForm } from '@/components/transaction-form';

export default function NovaTransacao() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: transaction, isLoading: isLoadingTransaction } =
    useTransaction(id);

  if (isEditing && isLoadingTransaction) {
    return (
      <ModalRoute title="Transação">
        <p className="py-8 text-center text-sm font-medium text-muted-foreground">Carregando...</p>
      </ModalRoute>
    );
  }

  return (
    <TransactionForm transaction={transaction} isEditing={isEditing} id={id} />
  );
}
