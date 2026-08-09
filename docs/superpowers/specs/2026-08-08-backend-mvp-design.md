# Spec: Backend MVP — Account, Purchase, Transaction, relatórios e testes unitários

- **Data**: 2026-08-08
- **Status**: aprovado (pendente de plano de implementação)
- **Relacionado**: [`docs/mvp-spec.md`](../../mvp-spec.md), [`docs/architecture.md`](../../architecture.md)

## Contexto

O backend hoje só tem `Category` implementado, como fatia de referência (routes → controllers → services → repositories → validators, com Prisma isolado no repository — ver `docs/architecture.md`). Conforme a seção "O que ainda não existe" desse documento, faltam:

- CRUD de `Account`, `Purchase` e `Transaction`.
- A lógica de geração automática de parcelas (`Purchase` → N `Transaction`).
- Os endpoints de leitura que alimentam as telas de Dashboard, Extrato e Cartões.
- Qualquer framework de testes automatizados.

Este documento especifica o design para fechar essas lacunas do MVP no backend, incluindo o escopo de testes unitários. É o primeiro artefato do fluxo spec → plano de implementação → código.

## Decisões de design

1. **Escopo**: um spec único cobrindo todo o MVP restante do backend (CRUD + geração de parcelas + relatórios + testes), em vez de decompor em specs sequenciais menores.
2. **Framework de teste**: [Vitest](https://vitest.dev/), não Jest — setup mais simples em TS/CJS, mais rápido.
3. **Escopo dos testes**: unitários em *services* (com repository mockado) e em funções puras de lógica de negócio. Repositories/Prisma não são testados neste spec — isso seria teste de integração, fora de escopo.
4. **Geração de parcelas**: divisão do valor com ajuste de centavos concentrado na última parcela, garantindo que a soma bata exatamente com `valor_total`. Datas sempre repetem o dia da compra a cada mês — não consideram `dia_fechamento`/`dia_vencimento` da conta na geração.
5. **Fatura atual/futura**: agrupamento por mês civil da data da parcela (`Transaction.data`), não por ciclo de fechamento do cartão.
6. **Limite disponível**: `limite - (faturaAtual + soma(faturasFuturas))`.
7. **Dashboard**: agregado de todas as contas, sem filtro por `accountId`.

## Design

### 1. CRUD — Account, Purchase, Transaction

Seguir exatamente o padrão de `category.{routes,controller,service,repository}.ts` + `validators/category.schema.ts` (arquivos de referência em `backend/src/`): rotas Express finas → controller faz `schema.parse` + chama service → service tem a regra de negócio e lança `AppError` → repository é o único lugar que importa `prisma`.

- **Account** (`src/{routes,controllers,services,repositories,validators}/account.*`)
  - `GET /accounts`, `GET /accounts/:id`, `POST /accounts`, `PUT /accounts/:id`, `DELETE /accounts/:id`.
  - Zod: `tipo` enum `CONTA_CORRENTE | DINHEIRO | CARTAO_CREDITO`; `limite`, `diaFechamento`, `diaVencimento` são obrigatórios apenas quando `tipo === 'CARTAO_CREDITO'`, validado via `.refine()` no schema.

- **Transaction** (`transaction.*`)
  - CRUD completo, mas o service bloqueia `create`/`update`/`delete` diretos quando `purchaseId` não é nulo, lançando `AppError('Transação de compra parcelada não pode ser editada diretamente', 400)`.
  - Transactions avulsas (`purchaseId: null`) são livres para CRUD.

- **Purchase** (`purchase.*`)
  - `GET /purchases`, `GET /purchases/:id`, `POST /purchases` (gera as parcelas — ver seção 2), `DELETE /purchases/:id` (cascateia a exclusão das `Transaction` geradas, dentro de `prisma.$transaction`).
  - **Sem `PUT`** — não há edição de compra parcelada no MVP; o usuário exclui e recria a compra se precisar mudar algo.

### 2. Geração de parcelas (Purchase → Transactions)

Função pura, extraída do service para ser testável isoladamente — sugerida em `src/services/purchase-installments.ts`:

```ts
function generateInstallments(input: {
  valorTotal: Decimal;
  numeroParcelas: number;
  dataCompra: Date;
}): Array<{
  valor: Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
}>
```

Regras:

- **Valor**: cada parcela = `floor(valorTotal * 100 / numeroParcelas) / 100`. A **última** parcela recebe `valorTotal - soma(demais parcelas)`, garantindo que o total bata exatamente com `valor_total` (sem sobra/falta de centavos).
- **Data**: a parcela *i* (1-indexada) cai em `dataCompra + (i-1)` meses, no mesmo dia do mês, com *clamping* para o último dia válido do mês alvo. Exemplo: compra em 31/01, 3x → parcelas em 31/01, 28/02, 31/03.
- `purchaseService.create` chama `generateInstallments` e persiste `Purchase` + todas as `Transaction` num único `prisma.$transaction`, evitando estado parcial em caso de falha.

### 3. Endpoints de leitura/agregação

Vertical `reports.*` sem model Prisma dedicado — o "repository" aqui é um wrapper fino de queries read-only sobre `Transaction`/`Account`.

- **`GET /dashboard`**
  ```json
  {
    "saldoMes": "0.00",
    "gastoPorCategoria": [{ "categoriaId": "...", "nome": "...", "total": "0.00" }],
    "faturaAtualPorCartao": [{ "accountId": "...", "nome": "...", "total": "0.00" }]
  }
  ```
  - `saldoMes` = soma(RECEITA) − soma(DESPESA) do mês corrente, todas as contas.
  - `gastoPorCategoria` = DESPESA do mês corrente, agrupado por categoria.
  - `faturaAtualPorCartao` = soma do mês corrente por conta do tipo `CARTAO_CREDITO`.

- **`GET /extrato`** — lista paginada de transactions.
  - Query params: `mes` (`YYYY-MM`, obrigatório), `categoriaId?`, `accountId?`.
  - O builder do `where` do Prisma é uma função pura testável separadamente: `buildExtratoWhere(params) → Prisma.TransactionWhereInput`.

- **`GET /accounts/:id/fatura`** (somente contas `CARTAO_CREDITO`; outros tipos retornam `AppError(400)`)
  ```json
  {
    "faturaAtual": "0.00",
    "faturasFuturas": [{ "mes": "YYYY-MM", "total": "0.00" }],
    "limiteDisponivel": "0.00"
  }
  ```
  - `limiteDisponivel = limite - (faturaAtual + soma(faturasFuturas))`.

As peças testadas unitariamente: `gastoPorCategoria`, `faturaAtualPorCartao`, `buildExtratoWhere` e o cálculo de `limiteDisponivel`. As chamadas Prisma (`groupBy`/`findMany`) em si não são testadas — fora do escopo "services + lógica pura" (decisão 3).

### 4. Setup de testes (Vitest)

- Adicionar `vitest` + `@vitest/coverage-v8` como devDependencies de `backend/`; scripts `test` e `test:watch` em `backend/package.json`.
- Arquivos `*.test.ts` colocados ao lado do source (ex: `src/services/purchase.service.test.ts`), no mesmo padrão de organização dos arquivos `category.*` — sem árvore `tests/` separada.
- Services testados com o repository mockado (`vi.mock('../repositories/x.repository')`), cobrindo regras de negócio: 404 via `AppError`, bloqueio de edição de transaction parcelada, ordem de orquestração em `purchaseService.create`.
- Funções puras (`generateInstallments`, calculadoras de relatório, `buildExtratoWhere`) testadas diretamente input→output, cobrindo casos de borda: arredondamento de centavos, clamping de fim de mês, compra com 1 parcela.
- Sem necessidade de `vitest.config.ts` complexo — ambiente Node padrão, sem banco de dados, sem `supertest`/camada HTTP nesta rodada.

### 5. Validação e erros

Reaproveita as convenções existentes sem mudanças: schemas Zod por recurso em `src/validators/`, `errorHandler` já trata `ZodError` → 400 e `AppError` → seu `status`.

## Fora de escopo (deste spec)

- Autenticação (fora do MVP, conforme `mvp-spec.md`).
- Edição de `Purchase` (regeneração de parcelas).
- Testes de integração contra Postgres real.
- Camada HTTP de testes (supertest) para os controllers/rotas.
- Cálculo de fatura por ciclo de fechamento (`dia_fechamento`) — fica como possível evolução pós-MVP.

## Arquivos críticos a criar

- `backend/src/{routes,controllers,services,repositories,validators}/account.*`
- `backend/src/{routes,controllers,services,repositories,validators}/transaction.*`
- `backend/src/{routes,controllers,services,repositories,validators}/purchase.*`
- `backend/src/services/purchase-installments.ts` (+ `.test.ts`)
- `backend/src/{routes,controllers,services,repositories}/reports.*` (dashboard/extrato/fatura)
- `backend/src/routes/index.ts` — montar as novas rotas (`/accounts`, `/purchases`, `/transactions`, `/dashboard`, `/extrato`)
- `backend/package.json` — devDependencies Vitest + scripts

## Verificação

- `pnpm exec tsc --noEmit` sem erros.
- `pnpm lint` limpo.
- `pnpm test` cobrindo: `generateInstallments` (arredondamento e clamping), regras de bloqueio de edição de `Transaction` parcelada, cálculo de `limiteDisponivel`, `buildExtratoWhere`, 404s via `AppError` em cada service.
- Teste manual via `docker compose up` + requests (curl/Postman) nos novos endpoints, comparando payloads com os contratos desta spec.

## Próximos passos

1. Self-review deste spec (placeholders, contradições, ambiguidade, escopo) — feito, ver abaixo.
2. Revisão do usuário sobre este documento.
3. Invocar `superpowers:writing-plans` para gerar o plano de implementação detalhado (ordem de construção, arquivos exatos, passos de verificação).
