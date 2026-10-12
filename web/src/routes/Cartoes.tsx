import { useMemo, useState } from 'react';
import {
  IconCreditCard,
  IconPencil,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AccountFormDialog } from '@/components/account-form-dialog';
import { CardWallet } from '@/components/card-wallet';
import { CardInvoiceDetails } from '@/components/card-invoice-details';
import { useAccounts, useDeleteAccount } from '@/hooks/use-accounts';
import { ApiError } from '@/lib/api';
import { accountTypeLabels } from '@/types/entities';
import type { Account } from '@/types/entities';

export default function Cartoes() {
  const { data: accounts, isLoading, isError } = useAccounts();
  const deleteAccount = useDeleteAccount();

  const [editing, setEditing] = useState<Account | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | undefined>(undefined);
  const [focusedAccountId, setFocusedAccountId] = useState<string | undefined>(
    undefined,
  );

  const cards = useMemo(
    () =>
      accounts?.filter((account) => account.tipo === 'CARTAO_CREDITO') ?? [],
    [accounts],
  );
  const others =
    accounts?.filter((account) => account.tipo !== 'CARTAO_CREDITO') ?? [];
  const focusedCard = cards.find((account) => account.id === focusedAccountId);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteAccount.mutateAsync(deleting.id);
      toast.success('Conta excluída com sucesso');
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível excluir',
      );
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Cartões e Contas
        </h2>
        <Button
          onClick={openCreate}
          size="sm"
          className="gap-1.5 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_16px_rgba(0,200,255,0.3)] hover:bg-primary/90"
        >
          <IconPlus size={16} stroke={2.5} /> Nova Conta
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-3xl bg-foreground/5" />
          <Skeleton className="h-20 w-full rounded-2xl bg-foreground/5" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm font-medium text-destructive">
          Não foi possível carregar as contas e cartões.
        </p>
      )}

      {accounts && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center">
          <IconCreditCard size={40} className="text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Nenhuma conta ou cartão cadastrado ainda.
          </p>
          <Button
            onClick={openCreate}
            className="rounded-xl bg-primary font-bold text-primary-foreground"
          >
            Cadastrar primeiro cartão
          </Button>
        </div>
      )}

      {/* Credit Cards Section */}
      {cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground px-1">
            Cartões de Crédito
          </span>
          <CardWallet
            cards={cards}
            onEdit={openEdit}
            onDelete={setDeleting}
            onFocusChange={setFocusedAccountId}
          />
          {focusedCard && (
            <CardInvoiceDetails key={focusedCard.id} account={focusedCard} />
          )}
        </section>
      )}

      {/* Other Accounts Section */}
      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground px-1">
            Outras Contas & Bancos
          </span>
          <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-4 md:bg-transparent md:border-none md:rounded-none bg-card border border-border rounded-2xl overflow-hidden md:overflow-visible">
            {others.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between border-b border-border p-4 last:border-b-0 md:rounded-3xl md:border md:bg-card md:p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-foreground/5 text-primary">
                    <IconCreditCard size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {account.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {accountTypeLabels[account.tipo]}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar conta"
                    onClick={() => openEdit(account)}
                    className="size-8 rounded-xl text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  >
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir conta"
                    onClick={() => setDeleting(account)}
                    className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  >
                    <IconTrash size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AccountFormDialog
        account={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "{deleting?.nome}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
