# Spec: Carrossel de cartões estilo carteira com itens da fatura atual

- **Data**: 2026-08-15
- **Status**: aprovado (pendente de plano de implementação)
- **Relacionado**: [`docs/web-architecture.md`](../../web-architecture.md), [`docs/api.md`](../../api.md)

## Contexto

Hoje a tela `Cartões` (`web/src/routes/Cartoes.tsx`) lista os cartões de crédito verticalmente, um `CardSummary` embaixo do outro, cada um mostrando fatura atual, barra de limite usado e faturas futuras (só totais). Não há como ver **quais compras/parcelas compõem** a fatura atual — o usuário só enxerga o total.

O pedido: transformar essa lista vertical num carrossel horizontal "estilo carteira" (arrastar para trocar de cartão, inspirado no app do Nubank/Apple Wallet), e abaixo do cartão em foco mostrar os itens (compras/parcelas) que compõem a fatura atual dele.

Decidido em brainstorming (com mockups visuais comparados pelo usuário): efeito de pilha, onde 1-2 cartões seguintes aparecem espiados atrás do cartão em foco, em escala reduzida.

## Decisões de design

1. **Escopo temporal**: só a fatura do mês corrente (mesma definição que já existe hoje em `reportsService.fatura` — mês civil, sem considerar `diaFechamento`). Sem navegação entre meses passados/futuros nesta feature — mantém `docs/api.md`'s "Faturas Futuras" como está hoje (só totais).
2. **Sem mudança de backend**: `GET /extrato?accountId=X&mes=YYYY-MM` já retorna exatamente as transações do cartão no mês corrente, já com `parcelaNumero`/`parcelaTotal` para o badge de parcela. Isso cobre 100% da necessidade de dados itemizados — não é preciso criar endpoint novo nem alterar `reports.service.ts`.
3. **Sem nova rota**: tudo continua em `/cartoes`. Nada de `/cartoes/:id` — a interação é 100% inline (arrastar troca o cartão em foco na mesma tela).
4. **Lib de carrossel**: adicionar o componente oficial `Carousel` do shadcn/ui (`pnpm dlx shadcn@latest add carousel`), que instala `embla-carousel-react` como dependência. Consistente com a convenção do projeto de sempre passar pela CLI do shadcn para primitivos novos, e dá gestos de arrastar reais (touch/pointer) em vez de reimplementar isso na mão.
5. **Efeito de pilha**: não é um recurso pronto do embla — implementado por cima da API dele (`emblaApi.scrollProgress()` + `emblaApi.on('scroll'/'select', ...)`) para interpolar `scale`/`translateY`/`opacity`/`z-index` de cada slide em função da distância até o slide selecionado. Só os 2 slides imediatamente seguintes ao focado recebem o efeito de "espiada"; os demais ficam com `opacity: 0` (evita acúmulo de elementos visíveis fora da pilha).
6. **Reaproveitamento de UI**: a linha de transação (ícone, descrição, categoria·conta, valor, badge de parcela "N/T", editar/excluir) é extraída de `Extrato.tsx` para um componente compartilhado `TransactionRow`, usado tanto no Extrato quanto no novo bloco "Itens da fatura atual". Evita duplicar ~50 linhas de JSX/lógica já testadas visualmente.
7. **Escopo de edição/exclusão**: só o cartão em foco (o da frente da pilha) tem os itens de fatura carregados e editáveis — os cartões espiados atrás não disparam fetch de itens (só de fatura/limite, que já é leve e hoje já roda para todos simultaneamente).
8. **Contas não-cartão**: a seção "Outras Contas & Bancos" (contas correntes/dinheiro) não muda — continua lista vertical simples como hoje.

## Design

### 1. Componente `CardWallet` (novo, `web/src/components/card-wallet.tsx`)

Substitui o bloco `cards.map(...)` vertical dentro da seção "Cartões de Crédito" em `Cartoes.tsx`. Recebe a lista de `Account` (já filtrada por `tipo === 'CARTAO_CREDITO'`) e os callbacks `onEdit`/`onDelete` que `Cartoes.tsx` já usa hoje.

Estrutura interna:
- `<Carousel>` do shadcn (`embla-carousel-react` por baixo) com um `CarouselItem` por cartão, renderizando uma face de cartão equivalente ao `CardSummary` atual (nome, fechamento/vencimento, badge "ABERTA", editar/excluir, fatura atual, barra de limite usado) — reaproveita a mesma estrutura visual/classes que `CardSummary` já tem hoje, sem reinventar.
- Um `useEffect` assina `emblaApi.on('scroll', ...)` e `emblaApi.on('select', ...)`: a cada scroll, recalcula `style` (transform/opacity/zIndex) de cada slide via um ref por slide; no `select`, atualiza o estado `focusedAccountId` (usado pelos blocos abaixo do carrossel).
- Com 1 único cartão: carrossel renderiza sem efeito de pilha (não há próximo slide para espiar) — `Carousel` do shadcn já lida bem com um único item.

### 2. Bloco "Itens da fatura atual" (novo, dentro de `Cartoes.tsx` ou extraído para `card-wallet-items.tsx`)

```tsx
const { data: items, isLoading } = useExtrato({
  accountId: focusedAccountId,
  mes: currentMonth(),
});
```

Reaproveita `useExtrato` (`web/src/hooks/use-transactions.ts`) exatamente como o Extrato usa hoje — mesma query key, mesmo cache, mesma invalidação em `invalidateAfterTransactionChange`. Lista plana ordenada por data desc (sem agrupar por dia, ao contrário do Extrato — dentro de uma única fatura mensal de um cartão o agrupamento por dia agrega pouco e polui a UI). Cada item usa `TransactionRow` (ver item 4). Estado vazio: "Nenhum lançamento nesta fatura ainda."

### 3. `useFatura` por cartão

Continua exatamente como hoje: cada face de cartão no carrossel chama `useFatura(account.id)` (já é assim para todos os cartões simultaneamente na lista vertical atual — nenhuma mudança de comportamento ou de carga).

### 4. Extração de `TransactionRow` (`web/src/components/transaction-row.tsx`)

```tsx
function TransactionRow({
  transaction, category, account, onEdit, onDelete,
}: {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  onEdit: () => void;
  onDelete: () => void;
}) { /* markup atual do item do Extrato.tsx, linhas ~262-320 */ }
```

`Extrato.tsx` passa a chamar `TransactionRow` dentro do `.map` de cada grupo de dia, no lugar do JSX inline atual. O novo bloco de itens da fatura em `Cartoes.tsx` faz o mesmo, resolvendo `category`/`account` via os mesmos `categoryMap`/`accountMap` (padrão já usado em `Extrato.tsx` e `Home.tsx`).

### 5. Faturas Futuras

Continua exatamente como está hoje (lista de totais por mês), mas passa a renderizar só para o `focusedAccountId`, junto do bloco de itens, abaixo do carrossel (fora da pilha de cards, que fica mais compacta sem essa seção dentro dela).

### Tratamento de erros/edge cases

- 0 cartões: mantém o empty-state atual da seção "Cartões de Crédito".
- Exclusão do cartão em foco: `useDeleteAccount` já invalida `queryKeys.accounts`; após a lista recarregar, se o cartão focado não existir mais, `focusedAccountId` cai para o primeiro cartão restante (ou `undefined` se não sobrar nenhum).
- Falha ao carregar itens (`isError` do `useExtrato`): mensagem de erro inline no bloco, mesmo padrão de texto usado em `Extrato.tsx`/`Categorias.tsx` (`text-destructive`, texto centralizado).

## Testes

- **Backend**: nenhum — feature é 100% frontend, sem mudança de contrato de API.
- **Frontend**: sem framework de teste em `web/` (decisão já documentada em `docs/web-architecture.md`). Verificação manual:
  1. Com 2+ cartões: arrastar troca o cartão em foco, efeito de pilha visível, itens/fatura futura atualizam para o cartão certo.
  2. Com 1 cartão: carrossel funciona sem pilha, sem erros.
  3. Editar/excluir só funciona no cartão da frente.
  4. Excluir o cartão em foco não quebra o estado (foco recai em outro cartão ou no empty-state).
  5. Editar/excluir uma transação dentro do bloco de itens reflete no `Extrato.tsx` (mesma query key/cache) e vice-versa.
  6. Tema claro e escuro.
  7. `Extrato.tsx` continua renderizando igual após a extração de `TransactionRow` (regressão visual).
