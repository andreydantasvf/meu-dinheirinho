# Referência da API (backend)

Contrato dos endpoints do backend, para consumo pelo app web. Gerado a partir do código-fonte (`backend/src/{routes,controllers,validators}/`) — se este documento e o código divergirem, o código manda; atualize este arquivo junto de qualquer mudança de rota/schema.

## Convenções gerais

- **Base URL**: `http://localhost:3000` em dev, ou o domínio de produção quando implantado. Ver `docs/web-architecture.md` para a variável `VITE_API_URL` (precisa ser o IP da rede local do Mac, não `localhost`, ao testar num iPhone físico). Nenhuma rota tem prefixo (`/accounts`, não `/api/accounts`).
- **Autenticação**: todas as rotas exigem o header `x-api-token`, **exceto** `/health`, `POST /auth/login` e `POST /auth/webauthn/login/*` — ver seção [Auth](#auth) abaixo.
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

`GET /health` → `200 { "status": "ok" }` — the only route with no auth requirement at all.

## Auth

Single-user, sem tabela de usuário. Duas formas de obter um token: senha ou WebAuthn (Face ID/Touch ID). Depois de obtido, envie o token em **todas** as outras rotas (exceto `/health` e os endpoints públicos de `/auth` listados abaixo) no header `x-api-token: <token>`. Sem esse header, ou com um token inválido/expirado, qualquer rota protegida responde `401 { "error": "Não autorizado" }`.

### `POST /auth/login`

| Método | Rota | Body |
|---|---|---|
| POST | `/auth/login` | `{ password }` |

- Pública (não exige `x-api-token`). Rate-limited: 5 tentativas / 15 min / IP.
- Sucesso (200): `{ "token": "<string opaca>", "name": "<string>" }` — token válido por 90 dias; `name` vem de `AUTH_USER_NAME` (env var opcional, default `""`, usada só para a saudação "Olá, {name}" na Home — string vazia quando não configurada).
- Falha (401): `{ "error": "Senha inválida" }`.

### `POST /auth/webauthn/register/options` e `/register/verify`

Registra um autenticador de plataforma (Face ID/Touch ID) para reautenticação sem senha. **Exigem `x-api-token` válido** — só é possível registrar logo após um login por senha bem-sucedido, nunca "a frio".

| Método | Rota | Body |
|---|---|---|
| POST | `/auth/webauthn/register/options` | — |
| POST | `/auth/webauthn/register/verify` | `RegistrationResponseJSON` (retorno de `startRegistration()` do `@simplewebauthn/browser`) |

- `register/options` retorna `PublicKeyCredentialCreationOptionsJSON` para passar direto a `startRegistration({ optionsJSON })` no cliente.
- `register/verify` retorna `{ "registered": true }` em caso de sucesso, ou `400 { "error": "Não foi possível verificar o dispositivo" }`.

### `POST /auth/webauthn/login/options` e `/login/verify`

Públicas (sem `x-api-token`) — é assim que o app reautentica sem digitar a senha.

| Método | Rota | Body |
|---|---|---|
| POST | `/auth/webauthn/login/options` | — |
| POST | `/auth/webauthn/login/verify` | `AuthenticationResponseJSON` (retorno de `startAuthentication()`) |

- `login/options` → `404 { "error": "Nenhum dispositivo registrado" }` se nenhum autenticador foi registrado ainda; senão retorna `PublicKeyCredentialRequestOptionsJSON`.
- `login/verify` → sucesso (200): `{ "token": "...", "name": "..." }`, mesmo formato/duração/origem do `name` que o login por senha. Falha: `401`.
- Rate-limited igual ao `/auth/login`.

⚠️ O desafio (`challenge`) de cada fluxo de registro/login fica em memória no processo do backend (single-user, single instância) — não há sessão nem store externo. Um desafio é consumido (ou substituído) a cada chamada de `*/options`, então dois registros/logins concorrentes não são suportados — irrelevante para um app single-user.

## Categories

CRUD simples; a única regra de negócio é o `409` ao excluir uma categoria em uso (abaixo).

| Método | Rota | Body |
|---|---|---|
| GET | `/categories` | — |
| GET | `/categories/:id` | — |
| POST | `/categories` | `{ nome, tipo, icone?, cor?, metaMensal? }` |
| PUT | `/categories/:id` | qualquer subconjunto dos campos acima |
| DELETE | `/categories/:id` | — |

- `tipo`: `"RECEITA" | "DESPESA"`
- `icone`, `cor`: strings livres, opcionais (o mobile decide o que armazenar aqui — ex. nome de ícone e hex color)
- `metaMensal`: número decimal positivo, opcional — meta de gasto mensal da categoria. Serializado na resposta como **string** (mesma convenção de Decimal, ex. `"300"`), nunca `number`. Só faz sentido para `tipo === "DESPESA"`; o backend não valida isso (é o cliente que garante, mesma filosofia adotada em outros pontos deste endpoint). Enviar `null` explicitamente remove uma meta já definida; omitir o campo em um `PUT` parcial não altera o valor existente.

`DELETE /categories/:id` numa categoria ainda referenciada por transações, compras parceladas ou despesas fixas → `409 { "error": "Não é possível excluir uma categoria com lançamentos" }`.

Response (200/201) de um Category:
```json
{ "id": "...", "nome": "Mercado", "tipo": "DESPESA", "icone": null, "cor": null, "metaMensal": null }
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

`DELETE /accounts/:id` numa conta ainda referenciada por transações, compras parceladas ou despesas fixas → `409 { "error": "Não é possível excluir uma conta com lançamentos" }`. O service checa o uso antes de excluir; a violação de foreign key em si (que daria `500` genérico) não é mapeada.

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
- `purchaseId`, `parcelaNumero`, `parcelaTotal`, `terceiro` **não são aceitos no body** — são somente-leitura, preenchidos internamente quando a transação vem de uma Purchase (`terceiro` é copiado da compra; ver Purchases).
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
  "fixedExpenseId": null,
  "parcelaNumero": null,
  "parcelaTotal": null,
  "terceiro": null,
  "createdAt": "2026-08-05T12:00:00.000Z"
}
```

## Purchases (compras parceladas)

Criar uma Purchase gera automaticamente N Transactions (uma por parcela). O `PUT` substitui a compra inteira (body completo, mesmo schema do `POST`) e regera todas as parcelas.

| Método | Rota | Body |
|---|---|---|
| GET | `/purchases` | — |
| GET | `/purchases/:id` | — |
| POST | `/purchases` | `{ accountId, categoryId, valorTotal, descricao, dataCompra, numeroParcelas, terceiro? }` |
| PUT | `/purchases/:id` | mesmo body do `POST` (substituição completa) |
| DELETE | `/purchases/:id` | — |

- `valorTotal`: número positivo, até 2 casas decimais.
- `numeroParcelas`: inteiro ≥ 1.
- `terceiro`: opcional, nome de quem comprou (até 60 caracteres, com trim). Marca uma **compra de terceiro** no cartão: as parcelas entram na fatura e no limite, mas ficam fora do `saldoMes` e do `gastoPorCategoria` do dashboard (ver Reports). Omitido, `null` ou vazio → `null` (compra própria). Como o `PUT` é substituição completa, omitir o campo num `PUT` remove o terceiro. É copiado para cada Transaction gerada.
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
  "terceiro": null,
  "createdAt": "2026-08-08T12:00:00.000Z"
}
```


## Fixed Expenses (Despesas Fixas e Assinaturas)

Semelhante às compras parceladas, mas sem número de parcelas. Uma despesa fixa gera transações infinitas (pré-geradas até 12 meses no futuro via cron job no backend).

| Método | Rota | Body |
|---|---|---|
| GET | `/fixed-expenses` | — |
| GET | `/fixed-expenses/:id` | — |
| POST | `/fixed-expenses` | `{ accountId, categoryId, valor, descricao, dataInicio }` |
| DELETE | `/fixed-expenses/:id` | — |

- `valor`: número positivo, até 2 casas decimais.
- `DELETE /fixed-expenses/:id`: Soft-delete. Altera o status para `CANCELED` e apaga **apenas as transações futuras** (data ≥ hoje). As transações passadas são preservadas para não quebrar o histórico.
- **Limite do Cartão**: Diferente de compras parceladas, transações originadas por `FixedExpense` **não abatem o `limiteDisponivel`** do cartão para meses futuros. Elas só comprometem o limite na fatura do mês atual.

Response de `POST /fixed-expenses`:
```json
{
  "id": "...",
  "accountId": "...",
  "categoryId": "...",
  "valor": "49.9",
  "descricao": "Netflix",
  "dataInicio": "2026-08-01T00:00:00.000Z",
  "status": "ACTIVE",
  "createdAt": "2026-08-08T12:00:00.000Z"
}
```

## Reminders (lembretes de entradas e saídas)

Lembretes **só notificam** (Web Push + Discord) — nunca criam transação nem afetam saldo. São uma regra de recorrência separada de `Transaction` (ver `architecture.md#lembretes`).

| Método | Rota | Body |
|---|---|---|
| GET | `/reminders` | — |
| GET | `/reminders/:id` | — |
| POST | `/reminders` | `{ titulo, tipo, valor?, recorrencia, diaDoMes?, dataUnica?, horario?, diasAntecedencia?, ativo?, fixedExpenseId? }` |
| PUT | `/reminders/:id` | qualquer subconjunto dos campos do POST |
| DELETE | `/reminders/:id` | — |
| POST | `/reminders/:id/test` | — (dispara agora, sem mexer no agendamento) |

- `tipo`: `"ENTRADA" \| "SAIDA"` (enum próprio, não reaproveita `RECEITA`/`DESPESA`).
- `valor`: opcional (`null` = sem valor). É só exibido na mensagem — Decimal serializado como string, igual aos outros campos de dinheiro.
- `recorrencia`: `"MENSAL"` exige `diaDoMes` (1–31; em meses curtos cai no último dia); `"UNICO"` exige `dataUnica` (envie `"yyyy-MM-dd"`; volta como meia-noite UTC — leia pelas partes UTC, não em horário local). O campo da outra recorrência é zerado (`null`) automaticamente. No `PUT`, a regra é validada sobre o registro já mesclado → `400` se trocar para `UNICO` sem `dataUnica`.
- `horario`: `"HH:mm"`, default `"09:00"`, interpretado no fuso `REMINDERS_TZ` do backend (default `America/Sao_Paulo`).
- `diasAntecedencia`: 0–7, default 0 — dispara N dias antes do dia do evento.
- `proximoDisparo` (response, UTC): recalculado a cada create/update a partir de "agora" — reativar um lembrete pausado **não** dispara os avisos perdidos. `null` = encerrado (lembrete único que já disparou).
- `fixedExpenseId`: opcional. Cancelar o gasto fixo (`DELETE /fixed-expenses/:id`) desativa (`ativo: false`) os lembretes ligados.
- Disparo: cron a cada 5 min (+ uma vez no startup). Se o servidor ficou fora do ar e vários disparos passaram, manda **uma** notificação ("venceu em DD/MM") e pula para a próxima ocorrência futura. Um canal falhando não impede os outros nem trava o agendamento.

Response de `POST /reminders`:
```json
{
  "id": "...",
  "titulo": "Freela da Nara",
  "tipo": "ENTRADA",
  "valor": "1500.5",
  "recorrencia": "MENSAL",
  "diaDoMes": 25,
  "dataUnica": null,
  "horario": "09:00",
  "diasAntecedencia": 0,
  "ativo": true,
  "proximoDisparo": "2026-10-25T12:00:00.000Z",
  "ultimoDisparo": null,
  "fixedExpenseId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Response de `POST /reminders/:id/test` — status por canal (`desativado` = canal sem env configurada no backend):
```json
{ "canais": [ { "canal": "discord", "status": "enviado" }, { "canal": "web-push", "status": "falhou", "erro": "..." } ] }
```

## Push (Web Push subscriptions)

| Método | Rota | Body |
|---|---|---|
| GET | `/push/config` | — → `{ enabled, publicKey }` (`publicKey` = VAPID pública, `null` se push desligado) |
| POST | `/push/subscriptions` | `PushSubscription.toJSON()` do navegador: `{ endpoint, keys: { p256dh, auth } }` → `201`; `503` se o servidor não tem VAPID |
| DELETE | `/push/subscriptions` | `{ endpoint }` → `204` |

- `endpoint` precisa ser HTTPS num push service de navegador (`fcm.googleapis.com`, `web.push.apple.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`) → senão `400`. Como o backend faz POST para esse endpoint a cada disparo, isso impede usar a rota para mandar requisições a hosts arbitrários (SSRF).
- Upsert por `endpoint` (re-inscrever o mesmo dispositivo não duplica). Subscriptions que o push service responde `404`/`410` são apagadas automaticamente no próximo envio.

## Reports (dashboard, extrato, fatura)

Camada somente-leitura de agregação sobre `Transaction`/`Account` — sem model Prisma próprio.

### `GET /dashboard?mes=YYYY-MM`

Agrega **todas as contas** para o mês informado (calendário, não ciclo de fatura). `mes` é **opcional** — mesmo formato/validação do `/extrato` (`YYYY-MM`, mês `01`-`12`, `400` se inválido); se omitido, usa o mês corrente.

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
- `saldoMes` = soma(RECEITA) − soma(DESPESA) do mês corrente, **sem** compras de terceiros (`terceiro` preenchido).
- `gastoPorCategoria` = apenas DESPESA do mês corrente, agrupado por categoria, também **sem** compras de terceiros.
- `faturaAtualPorCartao` = soma do mês corrente por conta `CARTAO_CREDITO`, **incluindo** compras de terceiros (⚠️ não filtra por `tipo`, então uma eventual RECEITA numa conta de cartão entraria na soma em vez de abater — improvável no fluxo atual, mas não impedido pelo schema).

### `GET /extrato?mes=YYYY-MM&categoriaId=...&accountId=...`

- `mes`: **obrigatório**, formato `YYYY-MM` com mês `01`-`12` (`2026-13` ou `2026-00` → `400`).
- `categoriaId`, `accountId`: opcionais, filtram além do mês.
- Response: array de `Transaction` **sem** `include` de category/account (só os IDs — se precisar do nome da categoria/conta na tela de Extrato, resolva no cliente com os dados já carregados de `/categories`/`/accounts`, ou peça para o backend adicionar `include` se isso virar gargalo).

```json
[
  { "id": "...", "accountId": "...", "categoryId": "...", "valor": "150.5", "descricao": "Supermercado", "data": "2026-08-05T00:00:00.000Z", "tipo": "DESPESA", "purchaseId": null, "fixedExpenseId": null, "parcelaNumero": null, "parcelaTotal": null, "terceiro": null, "createdAt": "..." }
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
  "limiteDisponivel": "3000",
  "terceirosFaturaAtual": [
    { "nome": "Maria", "total": "120" }
  ]
}
```
- `faturaAtual` = soma das transações do cartão no mês corrente (mês civil, não ciclo de fechamento).
- `faturasFuturas` = soma agrupada por mês das transações em meses futuros, ordenado ascendente.
- `limiteDisponivel` = `limite − (faturaAtual + soma(faturasFuturas))`.
- Compras de terceiros entram normalmente nos três campos acima.
- `terceirosFaturaAtual` = parte da `faturaAtual` que é de terceiros, somada por nome (match exato do `terceiro`), ordenada por nome. Vazio se não houver.

## O que não existe ainda

- Paginação em nenhuma rota de listagem (`GET /accounts`, `/transactions`, `/purchases`, `/categories` retornam tudo).
- Include de relações (category/account) nos endpoints que retornam Transaction — sempre vêm só os IDs.
