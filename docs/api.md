# Referência da API (backend)

Contrato dos endpoints do backend, para consumo pelo app mobile. Gerado a partir do código-fonte (`backend/src/{routes,controllers,validators}/`) — se este documento e o código divergirem, o código manda; atualize este arquivo junto de qualquer mudança de rota/schema.

## Convenções gerais

- **Base URL**: `http://localhost:3000` (simulador iOS) ou `http://<IP-da-rede-local-do-Mac>:3000` (dispositivo físico via Expo Go — ver `docs/architecture.md`, seção "Conectando com o backend"). Nenhuma rota tem prefixo (`/accounts`, não `/api/accounts`).
- **Sem autenticação** — decisão consciente do MVP, nenhum header de auth é esperado.
- **Content-Type**: `application/json` em todos os bodies de request/response.
- **IDs**: strings `cuid()` geradas pelo Prisma (ex: `"clx1a2b3c..."`), não incrementais.
- **Datas**: strings ISO 8601 (ex: `"2026-08-01T00:00:00.000Z"`) tanto em request quanto em response. No request, aceitam qualquer formato que `z.coerce.date()` reconheça (`"2026-08-01"` funciona).
- **Valores monetários (`Prisma.Decimal`) — ⚠️ ponto de atenção**: campos como `valor`, `valorTotal`, `limite`, `total`, `saldoMes`, `faturaAtual`, `limiteDisponivel` são serializados como **string**, não `number` (evita perda de precisão de ponto flutuante do JSON). E não vêm necessariamente com 2 casas decimais fixas — `Decimal.toJSON()` produz `"100.5"`, não `"100.50"`, quando o valor é exatamente `100.5`. **No mobile, sempre faça `Number(valor).toFixed(2)` (ou uma lib de decimal) antes de exibir — nunca concatene a string direto na tela nem assuma 2 casas.**
- **Erros** — formato uniforme via middleware global (`backend/src/middlewares/error-handler.ts`):
  - Validação (Zod) → `400 { "error": "Dados inválidos", "issues": [...] }` (`issues` é o array bruto do Zod, com `path`/`message` por campo)
  - Erro de negócio (`AppError`, ex: recurso não encontrado) → status variável (normalmente `404` ou `400`) `{ "error": "<mensagem em português>" }`
  - Rota inexistente → `404 { "error": "Rota não encontrada" }`
  - Erro não tratado → `500 { "error": "Internal server error" }`

## Health check

`GET /health` → `200 { "status": "ok" }`

## Categories

CRUD simples, sem regras de negócio especiais.

| Método | Rota | Body |
|---|---|---|
| GET | `/categories` | — |
| GET | `/categories/:id` | — |
| POST | `/categories` | `{ nome, tipo, icone?, cor? }` |
| PUT | `/categories/:id` | qualquer subconjunto dos campos acima |
| DELETE | `/categories/:id` | — |

- `tipo`: `"RECEITA" | "DESPESA"`
- `icone`, `cor`: strings livres, opcionais (o mobile decide o que armazenar aqui — ex. nome de ícone e hex color)

Response (200/201) de um Category:
```json
{ "id": "...", "nome": "Mercado", "tipo": "DESPESA", "icone": null, "cor": null }
```

## Accounts

| Método | Rota | Body |
|---|---|---|
| GET | `/accounts` | — |
| GET | `/accounts/:id` | — |
| POST | `/accounts` | `{ nome, tipo, limite?, diaFechamento?, diaVencimento? }` |
| PUT | `/accounts/:id` | qualquer subconjunto dos campos acima |
| DELETE | `/accounts/:id` | — |

- `tipo`: `"CONTA_CORRENTE" | "DINHEIRO" | "CARTAO_CREDITO"`
- **Regra condicional**: se `tipo === "CARTAO_CREDITO"`, `limite`, `diaFechamento` e `diaVencimento` são **obrigatórios** (400 se faltarem) — tanto no create quanto no update (se o update alterar `tipo` para `CARTAO_CREDITO`; um update que não toca em `tipo` não é bloqueado). Para os outros tipos, esses três campos são ignorados/opcionais.
- `limite`: número positivo, até 2 casas decimais.
- `diaFechamento`, `diaVencimento`: inteiros de 1 a 31 (dia do mês).

Response de um Account:
```json
{
  "id": "...",
  "nome": "Nubank",
  "tipo": "CARTAO_CREDITO",
  "limite": "5000",
  "diaFechamento": 10,
  "diaVencimento": 17,
  "createdAt": "2026-08-01T12:00:00.000Z",
  "updatedAt": "2026-08-01T12:00:00.000Z"
}
```

⚠️ `DELETE /accounts/:id` numa conta que ainda tem transações/compras associadas falha com **500 genérico** (violação de FK no Postgres não é mapeada para um erro amigável ainda — problema conhecido, não corrigido neste momento). Trate isso no mobile como "não foi possível excluir, a conta tem lançamentos" até o backend mapear para um 409.

## Transactions

CRUD completo, **exceto** para transações que pertencem a uma Purchase (compra parcelada) — essas só podem ser criadas pelo fluxo de `POST /purchases` (abaixo), nunca editadas/excluídas diretamente.

| Método | Rota | Body |
|---|---|---|
| GET | `/transactions` | — |
| GET | `/transactions/:id` | — |
| POST | `/transactions` | `{ accountId, categoryId, valor, descricao, data, tipo }` |
| PUT | `/transactions/:id` | qualquer subconjunto dos campos acima |
| DELETE | `/transactions/:id` | — |

- `tipo`: `"RECEITA" | "DESPESA"`
- `valor`: número positivo, até 2 casas decimais (`multipleOf(0.01)` — `100.555` é rejeitado com 400, `100.55` é aceito).
- `purchaseId`, `parcelaNumero`, `parcelaTotal` **não são aceitos no body** — são somente-leitura, preenchidos internamente quando a transação vem de uma Purchase.
- `PUT`/`DELETE` numa transação com `purchaseId` preenchido → `400 { "error": "Transação de compra parcelada não pode ser editada diretamente" }`.

Response de uma Transaction:
```json
{
  "id": "...",
  "accountId": "...",
  "categoryId": "...",
  "valor": "150.5",
  "descricao": "Supermercado",
  "data": "2026-08-05T00:00:00.000Z",
  "tipo": "DESPESA",
  "purchaseId": null,
  "parcelaNumero": null,
  "parcelaTotal": null,
  "createdAt": "2026-08-05T12:00:00.000Z"
}
```

## Purchases (compras parceladas)

Criar uma Purchase gera automaticamente N Transactions (uma por parcela). **Não existe `PUT`** — para "editar" uma compra parcelada, exclua e recrie.

| Método | Rota | Body |
|---|---|---|
| GET | `/purchases` | — |
| GET | `/purchases/:id` | — |
| POST | `/purchases` | `{ accountId, categoryId, valorTotal, descricao, dataCompra, numeroParcelas }` |
| DELETE | `/purchases/:id` | — |

- `valorTotal`: número positivo, até 2 casas decimais.
- `numeroParcelas`: inteiro ≥ 1.
- `DELETE /purchases/:id` exclui a Purchase **e** todas as Transactions geradas por ela (cascata atômica).

**Regras de geração de parcelas** (calculadas no backend, não no mobile):
- Valor de cada parcela = `valorTotal / numeroParcelas`, arredondado por centavo; a diferença de arredondamento é absorvida pela **última** parcela — a soma das parcelas sempre bate exatamente com `valorTotal`.
- Data de cada parcela = `dataCompra` + N meses, repetindo o dia do mês da compra, com ajuste para o último dia válido em meses mais curtos (compra em 31/01 → parcelas em 31/01, 28/02, 31/03...). Não considera dia de fechamento/vencimento do cartão.
- Todas as transações geradas têm `tipo: "DESPESA"`.

Response de `POST /purchases` (a Purchase criada, não as transações — use `GET /transactions` ou `GET /extrato` para ver as parcelas geradas):
```json
{
  "id": "...",
  "accountId": "...",
  "categoryId": "...",
  "valorTotal": "300",
  "descricao": "Notebook",
  "dataCompra": "2026-08-01T00:00:00.000Z",
  "numeroParcelas": 3,
  "createdAt": "2026-08-08T12:00:00.000Z"
}
```

## Reports (dashboard, extrato, fatura)

Camada somente-leitura de agregação sobre `Transaction`/`Account` — sem model Prisma próprio.

### `GET /dashboard`

Sem parâmetros. Agrega **todas as contas**, mês corrente (calendário, não ciclo de fatura).

```json
{
  "saldoMes": "800",
  "gastoPorCategoria": [
    { "categoriaId": "...", "nome": "Mercado", "total": "200" }
  ],
  "faturaAtualPorCartao": [
    { "accountId": "...", "nome": "Nubank", "total": "200" }
  ]
}
```
- `saldoMes` = soma(RECEITA) − soma(DESPESA) do mês corrente.
- `gastoPorCategoria` = apenas DESPESA do mês corrente, agrupado por categoria.
- `faturaAtualPorCartao` = soma do mês corrente por conta `CARTAO_CREDITO` (⚠️ não filtra por `tipo`, então uma eventual RECEITA numa conta de cartão entraria na soma em vez de abater — improvável no fluxo atual, mas não impedido pelo schema).

### `GET /extrato?mes=YYYY-MM&categoriaId=...&accountId=...`

- `mes`: **obrigatório**, formato `YYYY-MM` com mês `01`-`12` (`2026-13` ou `2026-00` → `400`).
- `categoriaId`, `accountId`: opcionais, filtram além do mês.
- Response: array de `Transaction` **sem** `include` de category/account (só os IDs — se precisar do nome da categoria/conta na tela de Extrato, resolva no cliente com os dados já carregados de `/categories`/`/accounts`, ou peça para o backend adicionar `include` se isso virar gargalo).

```json
[
  { "id": "...", "accountId": "...", "categoryId": "...", "valor": "150.5", "descricao": "Supermercado", "data": "2026-08-05T00:00:00.000Z", "tipo": "DESPESA", "purchaseId": null, "parcelaNumero": null, "parcelaTotal": null, "createdAt": "..." }
]
```

### `GET /accounts/:id/fatura`

Só para contas `tipo === "CARTAO_CREDITO"` — outro tipo retorna `400 { "error": "Conta não é um cartão de crédito" }`. Conta inexistente → `404`.

```json
{
  "faturaAtual": "800",
  "faturasFuturas": [
    { "mes": "2026-09", "total": "700" },
    { "mes": "2026-10", "total": "500" }
  ],
  "limiteDisponivel": "3000"
}
```
- `faturaAtual` = soma das transações do cartão no mês corrente (mês civil, não ciclo de fechamento).
- `faturasFuturas` = soma agrupada por mês das transações em meses futuros, ordenado ascendente.
- `limiteDisponivel` = `limite − (faturaAtual + soma(faturasFuturas))`.

## O que não existe ainda

- Paginação em nenhuma rota de listagem (`GET /accounts`, `/transactions`, `/purchases`, `/categories` retornam tudo).
- Autenticação (fora de escopo do MVP).
- `PUT`/edição de Purchase.
- Include de relações (category/account) nos endpoints que retornam Transaction — sempre vêm só os IDs.
