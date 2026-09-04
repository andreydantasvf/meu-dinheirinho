# Spec: Gastos Fixos e Assinaturas

## Visão do Recurso
Um novo conceito para gerenciar gastos que se repetem mensalmente, mas sem um número determinado de parcelas.
- **Transação Fixa**: Despesa atrelada a uma Conta Corrente ou Dinheiro (ex: Aluguel, Financiamento).
- **Assinatura**: Despesa atrelada a um Cartão de Crédito (ex: Netflix, Spotify).

Ambos utilizam a mesma modelagem de dados no backend, diferindo apenas na forma de exibição e no impacto visual para o usuário final.

## Escopo e Regras de Negócio

### 1. Geração de Transações
Para manter a integridade dos dados, a flexibilidade de editar lançamentos individuais (como quando a conta de luz tem um valor diferente num determinado mês) e facilitar as consultas:
- A `FixedExpense` atua como um "contrato".
- Quando criada, ela pré-gera instâncias normais na tabela `Transaction` para os próximos 12 meses.
- Um **Cron Job** (`node-cron`) rodando no backend avalia diariamente se há necessidade de estender a janela. Assim, o extrato projetado sempre tem 12 meses de despesas fixas criadas.

### 2. Deleção e Cancelamento (Soft Delete)
Ao contrário das compras parceladas (`Purchase`) onde deletar exclui todas as parcelas já que são vinculadas ao limite, o cancelamento de uma despesa fixa:
- Marca o status da `FixedExpense` como `CANCELED`.
- Apaga somente as instâncias (transações) geradas cuja data for igual ou superior à data atual.
- Preserva o histórico. Dessa forma, as mensalidades passadas já pagas da assinatura da Netflix continuam no extrato para contabilidade.

### 3. Impacto no Limite do Cartão
Se uma despesa fixa for lançada em um `CARTAO_CREDITO`, ela aparecerá nas `faturasFuturas` (para previsão de gastos).
Porém, ela **não bloqueia o limite do cartão antecipadamente**. O `limiteDisponivel` exclui inteligentemente qualquer transação futura que venha de um `fixedExpenseId`, já que você não paga o valor integral de um ano de assinatura no momento em que ela é contratada.

## Modelagem de Dados (Schema)

```prisma
model FixedExpense {
  id             String          @id @default(cuid())
  accountId      String          @map("account_id")
  categoryId     String          @map("category_id")
  valor          Decimal
  descricao      String
  dataInicio     DateTime        @map("data_inicio")
  status         String          @default("ACTIVE") // ACTIVE ou CANCELED
  createdAt      DateTime        @default(now()) @map("created_at")

  transactions   Transaction[]
}

// Em Transaction:
// fixedExpenseId String?
```

## Telas (Web)

Reaproveitamos as telas já existentes:
1. **Nova Transação (Saída)**:
   - Ganhou um *Toggle*: `Despesa fixa (mensal)`.
   - Dispara `POST /fixed-expenses`.
2. **Nova Compra Parcelada**:
   - Ganhou um *Toggle*: `É uma assinatura?`.
   - Oculta o passo a passo de "Número de Parcelas" quando ativado.
   - Dispara `POST /fixed-expenses`.
3. **Extrato e Cartões**:
   - Uma *badge* na cor cinza substitui o indicador de parcelas (ex `2/12`).
   - Mostra o ícone `IconRepeat` + Texto **Assinatura** (cartões) ou **Fixo** (outras contas).
