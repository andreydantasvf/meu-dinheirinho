# App público (self-host + demo sem backend): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano task a task. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** tornar o repo apresentável para self-host (README, LICENSE, env/docs neutros) e criar um build "demo" do `web/` que roda 100% no navegador, sem backend, para publicar na Vercel como portfólio.

**Arquitetura:** com `vite --mode demo`, o `apiFetch` delega para `demoFetch` (`web/src/demo/`). O `demoFetch` roteia `método + path` para handlers que espelham os services do backend sobre um "banco" em memória, persistido no `localStorage`. A lógica pura do backend é portada para `web/src/demo/logic/` usando `decimal.js`. O código da demo só entra por `import()` dinâmico atrás de `import.meta.env.MODE === 'demo'`, então o build normal não o inclui.

**Stack:** Vite 8 + React 19 + TanStack Query (existentes) e `decimal.js` (nova dependência).

**Spec:** `docs/superpowers/specs/2026-10-11-app-publico-demo-design.md`

## Restrições globais

- Tudo em pt-BR: README, docs, textos de UI e comentários novos.
- **Sem testes automatizados no `web/`.** A verificação é feita por `pnpm lint`, `pnpm build` (que roda `tsc -b`), `pnpm build:demo` e roteiro manual no Playwright.
- **Flag da demo = modo do Vite `demo`** (`import.meta.env.MODE === 'demo'`), ativada por `vite --mode demo` / `vite build --mode demo`. Isso refina o `VITE_DEMO_MODE` + `.env.demo` do spec: `MODE` é sempre uma string literal substituída em build, o que garante a eliminação do código morto. O spec é atualizado na Task 10.
- **Todo `import()` de algo em `src/demo/` fica dentro de um `if` com `import.meta.env.MODE === 'demo'` escrito inline** (não via `IS_DEMO` importado), para o bundler eliminar o chunk no build normal.
- `tsconfig.app.json` tem `erasableSyntaxOnly` e `verbatimModuleSyntax`: nada de parameter properties (`constructor(public x)`) nem `enum`, e use `import type` para tipos.
- Prettier: aspas simples, ponto e vírgula, trailing comma. Rode `pnpm format` antes de cada commit.
- Comandos do `web/` rodam **no container** (o host não tem `web/node_modules`): `docker compose up -d web` uma vez, depois `docker compose exec web <cmd>`.
- **CHECK** (usado no fim de cada task): `docker compose exec web sh -c "pnpm format && pnpm lint && pnpm build && pnpm build:demo"`. O resultado esperado é sair com código 0.
- **PREVIEW DEMO** (para conferir no navegador): `docker compose run --rm --no-deps -p 4173:4173 web sh -c "pnpm build:demo && pnpm preview --host 0.0.0.0 --port 4173"` (rodar em background) e abrir `http://localhost:4173`.
- Os registros do "banco" da demo ficam **no formato JSON da API** (dinheiro como string Decimal, ex. `"100.5"`; datas em ISO). Os cálculos convertem para `Decimal` e voltam com `.toString()`.
- Mensagens e status de erro iguais aos do backend: `404 '<Entidade> não encontrada'`, `400 'Dados inválidos'` (onde o backend falharia no Zod), `500 'Internal server error'` (onde o backend violaria uma foreign key).
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Foco da revisão

1. **Bundle de produção sem código da demo.** Depois de `pnpm build`, `grep -rl "demo.local" web/dist` precisa voltar vazio. Esse grep entra como passo das Tasks 1 e 7, que são as tasks que adicionam `import()` de `src/demo/`.
2. **Recarregar a página e voltar à demo dias ou meses depois.** O `ensureHorizon` e o avanço de lembretes rodam a cada carregamento sem duplicar transações. Coberto por passo manual na Task 6: recarregar 2× e comparar a contagem de transações.
3. **Dados salvos de uma versão antiga do seed.** `demoDb.version` diferente de `DEMO_DB_VERSION` precisa regenerar o seed, não quebrar a UI. Coberto por passo manual na Task 6.
4. **O cache do TanStack Query não pode compartilhar objetos com o "banco".** Uma mutação do cache não pode alterar o `localStorage`. Coberto pelo `structuredClone` no `demoFetch` (Task 1) e por um passo manual na Task 9: editar, cancelar sem salvar e conferir que nada mudou.
5. **Excluir conta ou categoria em uso** mostra o toast certo (a conta usa o caso especial `status === 500` em `Cartoes.tsx`). Passo manual na Task 9.

---

### Task 1: Fundação do modo demo (flag, scripts, `demoFetch`, store vazio)

**Arquivos:**
- Modificar: `web/package.json` (scripts e dependência `decimal.js`)
- Criar: `web/src/lib/demo-mode.ts`
- Modificar: `web/src/lib/api.ts`
- Criar: `web/src/demo/types.ts`, `web/src/demo/errors.ts`, `web/src/demo/router.ts`, `web/src/demo/routes.ts`, `web/src/demo/demo-fetch.ts`, `web/src/demo/store.ts`, `web/src/demo/seed.ts` (provisório, reescrito na Task 6)

**Interfaces:**
- Produz:
  - `IS_DEMO: boolean` e `DEMO_USER_NAME = 'Visitante'` (`lib/demo-mode.ts`)
  - `DemoDb` e `FixedExpense` (`demo/types.ts`)
  - `DemoHttpError(status, message)`, `invalid()` e `internalError()` (`demo/errors.ts`)
  - `Route`, `HandlerContext` e `matchRoute(routes, method, pathname)` (`demo/router.ts`)
  - `routes: Route[]` (`demo/routes.ts`; as próximas tasks acrescentam itens a ele)
  - `getDb()`, `saveDb(db)` e `resetDemo()` (`demo/store.ts`)
  - `DEMO_DB_VERSION` e `createSeed(hoje: Date): DemoDb` (`demo/seed.ts`)

- [ ] **Passo 1: instalar o `decimal.js` e adicionar os scripts**

```bash
docker compose up -d web
docker compose exec web pnpm add decimal.js --store-dir /root/.local/share/pnpm/store
rm -rf web/.pnpm-store
docker compose build web
```

Em `web/package.json`, dentro de `"scripts"`, logo depois de `"build"`:

```json
    "dev:demo": "vite --mode demo",
    "build:demo": "tsc -b && vite build --mode demo",
```

- [ ] **Passo 2: criar `web/src/lib/demo-mode.ts`**

```ts
// Modo demo: build com `--mode demo` (pnpm dev:demo / pnpm build:demo). O app roda sem
// backend — apiFetch delega para a API falsa em src/demo/, com os dados no localStorage
// do visitante. Ver docs/web-architecture.md#modo-demo.
export const IS_DEMO = import.meta.env.MODE === 'demo';

export const DEMO_USER_NAME = 'Visitante';
```

- [ ] **Passo 3: criar `web/src/demo/types.ts`**

```ts
import type {
  Account,
  Category,
  Purchase,
  Reminder,
  Transaction,
} from '@/types/entities';

// Gasto fixo como o backend serializa (o web não tem tipo próprio porque nunca lista gastos fixos).
export type FixedExpense = {
  id: string;
  accountId: string;
  categoryId: string;
  valor: string;
  descricao: string;
  dataInicio: string;
  status: 'ACTIVE' | 'CANCELED';
  createdAt: string;
};

// O "banco" da demo. Os registros ficam no formato JSON da API (dinheiro como string
// Decimal, datas ISO), então responder um GET é só devolver uma cópia.
export type DemoDb = {
  version: number;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  purchases: Purchase[];
  fixedExpenses: FixedExpense[];
  reminders: Reminder[];
};
```

- [ ] **Passo 4: criar `web/src/demo/errors.ts`**

```ts
// Equivalente ao AppError do backend: status + mensagem que o error-handler devolveria.
export class DemoHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Onde o Zod do backend rejeitaria o body/query → 400 "Dados inválidos".
export function invalid(): DemoHttpError {
  return new DemoHttpError(400, 'Dados inválidos');
}

// Onde o backend violaria uma foreign key (ex.: excluir conta/categoria em uso) → 500
// genérico, ver docs/api.md. Cartoes.tsx trata esse 500 com uma mensagem amigável.
export function internalError(): DemoHttpError {
  return new DemoHttpError(500, 'Internal server error');
}
```

- [ ] **Passo 5: criar `web/src/demo/router.ts`**

```ts
import type { DemoDb } from './types';

export type HandlerContext = {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  db: DemoDb;
};

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Mesmo formato das rotas Express do backend, ex. `/accounts/:id/fatura`. */
  pattern: string;
  /** Retorna o JSON da resposta; `undefined` equivale a um 204. */
  handler: (ctx: HandlerContext) => unknown;
};

export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    const patternParts = route.pattern.split('/').filter(Boolean);
    if (patternParts.length !== parts.length) continue;

    const params: Record<string, string> = {};
    const matches = patternParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return part === parts[i];
    });
    if (matches) return { route, params };
  }
  return null;
}
```

- [ ] **Passo 6: criar `web/src/demo/routes.ts`**

```ts
import type { Route } from './router';

// Tabela de endpoints da API falsa — um bloco por entidade, espelhando backend/src/routes/.
export const routes: Route[] = [];
```

- [ ] **Passo 7: criar `web/src/demo/seed.ts` (provisório)**

```ts
import type { DemoDb } from './types';

// Bump ao mudar o formato do DemoDb ou o seed: bancos salvos com outra versão são descartados.
export const DEMO_DB_VERSION = 1;

export function createSeed(_hoje: Date): DemoDb {
  return {
    version: DEMO_DB_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    purchases: [],
    fixedExpenses: [],
    reminders: [],
  };
}
```

- [ ] **Passo 8: criar `web/src/demo/store.ts`**

```ts
import { persister, queryClient } from '@/lib/query-client';
import { createSeed, DEMO_DB_VERSION } from './seed';
import type { DemoDb } from './types';

const STORAGE_KEY = 'demoDb';

let db: DemoDb | null = null;

function load(): DemoDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoDb;
    return parsed.version === DEMO_DB_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDb(current: DemoDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage cheio/bloqueado (ex.: aba privada): a demo segue só em memória.
  }
}

export function getDb(): DemoDb {
  if (db) return db;
  const loaded = load() ?? createSeed(new Date());
  saveDb(loaded);
  db = loaded;
  return db;
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem acesso ao storage: o reload abaixo já recomeça do seed em memória.
  }
  db = null;
  persister.removeClient();
  queryClient.clear();
  window.location.assign('/');
}
```

- [ ] **Passo 9: criar `web/src/demo/demo-fetch.ts`**

```ts
import { ApiError } from '@/lib/api';
import { DemoHttpError } from './errors';
import { matchRoute } from './router';
import { routes } from './routes';
import { getDb, saveDb } from './store';

type DemoFetchOptions = { method?: string; body?: unknown };

// Substitui a chamada HTTP no modo demo (ver src/lib/api.ts). Erros saem como ApiError com o
// mesmo status/mensagem do backend, então toasts e tratamentos da UI funcionam igual.
export async function demoFetch<T>(
  path: string,
  options: DemoFetchOptions = {},
): Promise<T> {
  const url = new URL(path, 'http://demo.local');
  const method = (options.method ?? 'GET').toUpperCase();
  const match = matchRoute(routes, method, url.pathname);
  if (!match) throw new ApiError('Rota não encontrada', 404);

  const db = getDb();
  // Ida e volta por JSON, como numa requisição real (ex.: Date vira string ISO).
  const body =
    options.body === undefined
      ? {}
      : (JSON.parse(JSON.stringify(options.body)) as Record<string, unknown>);

  try {
    // Handlers validam tudo antes de mutar o db, então um erro nunca deixa estado parcial.
    const result = match.route.handler({
      params: match.params,
      query: url.searchParams,
      body,
      db,
    });
    if (method !== 'GET') saveDb(db);
    // Cópia: o cache do TanStack Query nunca pode segurar referências do "banco".
    return (result === undefined ? undefined : structuredClone(result)) as T;
  } catch (error) {
    if (error instanceof DemoHttpError) {
      throw new ApiError(error.message, error.status);
    }
    throw error;
  }
}
```

- [ ] **Passo 10: ligar o `demoFetch` no `apiFetch`**

Em `web/src/lib/api.ts`, logo no início do corpo de `apiFetch` (antes de `const { skipAuth, body, headers, ...rest } = options;`):

```ts
  // Comparação inline com MODE (e não via IS_DEMO importado) para o bundler eliminar este
  // import() no build normal: src/demo/ não pode entrar no bundle de produção.
  if (import.meta.env.MODE === 'demo') {
    const { demoFetch } = await import('@/demo/demo-fetch');
    return demoFetch<T>(path, { method: options.method, body: options.body });
  }
```

- [ ] **Passo 11: rodar o CHECK e confirmar que o bundle de produção está limpo**

```bash
docker compose exec web sh -c "pnpm format && pnpm lint && pnpm build && pnpm build:demo"
docker compose exec web sh -c "pnpm build && ! grep -rl 'demo.local' dist && echo PROD-LIMPO"
docker compose exec web sh -c "pnpm build:demo && grep -rl 'demo.local' dist"
```

Resultado esperado: o primeiro comando sai com 0; o segundo imprime `PROD-LIMPO`; o terceiro lista pelo menos um arquivo `.js`. Se o segundo falhar, o `import()` não foi eliminado. Confira se a condição está inline, exatamente como no Passo 10.

- [ ] **Passo 12: commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/src/lib/demo-mode.ts web/src/lib/api.ts web/src/demo
git commit -m "feat(web): fundação do modo demo (apiFetch → demoFetch no --mode demo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Port da lógica pura do backend para `demo/logic/`

**Arquivos:**
- Criar: `web/src/demo/logic/report-calculations.ts`, `web/src/demo/logic/purchase-installments.ts`, `web/src/demo/logic/fixed-expense-generator.ts`, `web/src/demo/logic/reminder-schedule.ts`

**Interfaces:**
- Produz:
  - `calcularSaldoMes`, `agruparGastoPorCategoria`, `agruparFaturaAtualPorCartao`, `mesParaIntervalo(mes)`, `currentMonthUTC()`, `agruparFaturasFuturas`, `somarValores` e `calcularLimiteDisponivel` (mesmas assinaturas do backend, com `Decimal` de `decimal.js`)
  - `generateInstallments({ valorTotal, numeroParcelas, dataCompra })`
  - `generateFixedExpenseTransactions({ valor, dataInicio, quantidadeMeses })` e `addMonthsClamped(date, months)`
  - `calcularProximoDisparo(reminder, agora, tz): Date | null`

- [ ] **Passo 1: criar `web/src/demo/logic/report-calculations.ts`**

É uma cópia de `backend/src/services/report-calculations.ts` com o `Prisma.Decimal` trocado por `Decimal` e sem `construirFiltroExtrato`/`ExtratoFiltro`, que dependem de tipos do Prisma. O handler de extrato filtra direto.

```ts
import Decimal from 'decimal.js';

// Port de backend/src/services/report-calculations.ts (Prisma.Decimal → decimal.js, que é a
// mesma lib por baixo). Mudou lá → espelhe aqui (docs/web-architecture.md#modo-demo).

export type TransactionForSaldo = {
  tipo: 'RECEITA' | 'DESPESA';
  valor: Decimal;
};

export function calcularSaldoMes(transactions: TransactionForSaldo[]): Decimal {
  return transactions.reduce((saldo, t) => {
    return t.tipo === 'RECEITA' ? saldo.plus(t.valor) : saldo.minus(t.valor);
  }, new Decimal(0));
}

export type TransactionComCategoria = {
  valor: Decimal;
  categoryId: string;
  category: { nome: string };
};

export type GastoPorCategoria = {
  categoriaId: string;
  nome: string;
  total: Decimal;
};

export function agruparGastoPorCategoria(
  transactions: TransactionComCategoria[],
): GastoPorCategoria[] {
  const totals = new Map<string, GastoPorCategoria>();
  for (const t of transactions) {
    const existing = totals.get(t.categoryId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.categoryId, {
        categoriaId: t.categoryId,
        nome: t.category.nome,
        total: t.valor,
      });
    }
  }
  return [...totals.values()];
}

export type TransactionComConta = {
  valor: Decimal;
  accountId: string;
  account: { nome: string };
};

export type FaturaPorCartao = {
  accountId: string;
  nome: string;
  total: Decimal;
};

export function agruparFaturaAtualPorCartao(
  transactions: TransactionComConta[],
): FaturaPorCartao[] {
  const totals = new Map<string, FaturaPorCartao>();
  for (const t of transactions) {
    const existing = totals.get(t.accountId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.accountId, {
        accountId: t.accountId,
        nome: t.account.nome,
        total: t.valor,
      });
    }
  }
  return [...totals.values()];
}

export function mesParaIntervalo(mes: string): { inicio: Date; fim: Date } {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mesNumero - 1, 1));
  const fim = new Date(Date.UTC(ano, mesNumero, 1));
  return { inicio, fim };
}

export function currentMonthUTC(): string {
  const hoje = new Date();
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type TransactionComData = { valor: Decimal; data: Date };

export type FaturaFutura = { mes: string; total: Decimal };

export function agruparFaturasFuturas(
  transactions: TransactionComData[],
): FaturaFutura[] {
  const totals = new Map<string, Decimal>();
  for (const t of transactions) {
    const chave = `${t.data.getUTCFullYear()}-${String(t.data.getUTCMonth() + 1).padStart(2, '0')}`;
    totals.set(chave, (totals.get(chave) ?? new Decimal(0)).plus(t.valor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total }));
}

export function somarValores(transactions: { valor: Decimal }[]): Decimal {
  return transactions.reduce((soma, t) => soma.plus(t.valor), new Decimal(0));
}

export function calcularLimiteDisponivel(input: {
  limite: Decimal;
  faturaAtual: Decimal;
  faturasFuturas: FaturaFutura[];
}): Decimal {
  const totalComprometido = input.faturasFuturas.reduce(
    (soma, f) => soma.plus(f.total),
    input.faturaAtual,
  );
  return input.limite.minus(totalComprometido);
}
```

- [ ] **Passo 2: criar `web/src/demo/logic/purchase-installments.ts`**

```ts
import Decimal from 'decimal.js';

// Port de backend/src/services/purchase-installments.ts. Mudou lá → espelhe aqui.

export type Installment = {
  valor: Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
};

export function generateInstallments(input: {
  valorTotal: Decimal | number | string;
  numeroParcelas: number;
  dataCompra: Date;
}): Installment[] {
  const valorTotal = new Decimal(input.valorTotal);
  const totalCentavos = valorTotal
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  const centavosPorParcela = totalCentavos
    .dividedBy(input.numeroParcelas)
    .toDecimalPlaces(0, Decimal.ROUND_FLOOR);

  const installments: Installment[] = [];
  let somaCentavos = new Decimal(0);

  for (let i = 1; i <= input.numeroParcelas; i++) {
    const isUltima = i === input.numeroParcelas;
    const valorCentavos = isUltima
      ? totalCentavos.minus(somaCentavos)
      : centavosPorParcela;
    somaCentavos = somaCentavos.plus(valorCentavos);

    installments.push({
      valor: valorCentavos.dividedBy(100),
      data: addMonthsClamped(input.dataCompra, i - 1),
      parcelaNumero: i,
      parcelaTotal: input.numeroParcelas,
    });
  }

  return installments;
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}
```

- [ ] **Passo 3: criar `web/src/demo/logic/fixed-expense-generator.ts`**

```ts
import Decimal from 'decimal.js';

// Port de backend/src/services/fixed-expense-generator.ts. Mudou lá → espelhe aqui.

export function generateFixedExpenseTransactions(input: {
  valor: Decimal | number | string;
  dataInicio: Date;
  quantidadeMeses: number;
}): { valor: Decimal; data: Date }[] {
  const valor = new Decimal(input.valor);
  const transactions = [];

  for (let i = 0; i < input.quantidadeMeses; i++) {
    transactions.push({
      valor: valor,
      data: addMonthsClamped(input.dataInicio, i),
    });
  }
  return transactions;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}
```

- [ ] **Passo 4: criar `web/src/demo/logic/reminder-schedule.ts`**

Copie `backend/src/services/reminder-schedule.ts` **inteiro e sem alterações** (o arquivo não tem imports) e acrescente uma linha de comentário no topo:

```ts
// Port de backend/src/services/reminder-schedule.ts (cópia literal — sem dependências). Mudou lá → espelhe aqui.
```

Comando:

```bash
{ echo '// Port de backend/src/services/reminder-schedule.ts (cópia literal — sem dependências). Mudou lá → espelhe aqui.'; cat backend/src/services/reminder-schedule.ts; } > web/src/demo/logic/reminder-schedule.ts
```

- [ ] **Passo 5: CHECK**

Rode o CHECK. Esperado: código 0. Os arquivos ainda não são importados por ninguém, mas o `tsc -b` checa tudo em `src/`.

- [ ] **Passo 6: commit**

```bash
git add web/src/demo/logic
git commit -m "feat(web): port da lógica pura do backend para a demo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Handlers de contas, categorias e transações

**Arquivos:**
- Criar: `web/src/demo/handlers/shared.ts`, `web/src/demo/handlers/accounts.ts`, `web/src/demo/handlers/categories.ts`, `web/src/demo/handlers/transactions.ts`
- Modificar: `web/src/demo/routes.ts`

**Interfaces:**
- Consome: `DemoDb`, `Route`, `DemoHttpError`, `invalid()` e `internalError()` (Task 1)
- Produz:
  - `shared.ts`: `newId()`, `nowIso()`, `findOr404(list, id, msg)`, `parseMoney(v, { centavos? })`, `parseDate(v)`, `requireString(v)`, `parseText(v)`, `parseIntInRange(v, min, max)`, `oneOf(v, options)`, `optionalField(body, key, parse)`, `definedOnly(obj)` e `assertRefs(db, accountId, categoryId)`
  - `accounts.ts`: `accountRoutes` e `createAccount(db, body)`
  - `categories.ts`: `categoryRoutes`
  - `transactions.ts`: `transactionRoutes` e `createTransaction(db, body)`

- [ ] **Passo 1: criar `web/src/demo/handlers/shared.ts`**

```ts
import Decimal from 'decimal.js';
import { DemoHttpError, internalError, invalid } from '../errors';
import type { DemoDb } from '../types';

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function findOr404<T extends { id: string }>(
  list: T[],
  id: string,
  message: string,
): T {
  const item = list.find((i) => i.id === id);
  if (!item) throw new DemoHttpError(404, message);
  return item;
}

// z.coerce.number().positive() (+ .multipleOf(0.01) quando `centavos`) → string Decimal,
// como o Prisma serializa ("100.50" vira "100.5").
export function parseMoney(
  value: unknown,
  { centavos = true }: { centavos?: boolean } = {},
): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n <= 0) {
    throw invalid();
  }
  const decimal = new Decimal(n);
  if (centavos && !decimal.times(100).isInteger()) throw invalid();
  return decimal.toString();
}

// z.coerce.date(): "2026-08-01" vira meia-noite UTC; ISO completo mantém o instante.
export function parseDate(value: unknown): string {
  if (value === null || value === undefined || value === '') throw invalid();
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString();
}

// z.string().min(1)
export function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw invalid();
  return value;
}

// z.string() (aceita string vazia)
export function parseText(value: unknown): string {
  if (typeof value !== 'string') throw invalid();
  return value;
}

// z.coerce.number().int().min(min).max(max)
export function parseIntInRange(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (value === null || value === '' || !Number.isInteger(n) || n < min || n > max) {
    throw invalid();
  }
  return n;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw invalid();
  return value as T;
}

// Campo opcional (create) ou de update parcial: ausente/undefined = "não mexer".
export function optionalField<T>(
  body: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => T,
): T | undefined {
  return body[key] === undefined ? undefined : parse(body[key]);
}

export function definedOnly<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

// No backend, conta/categoria inexistente estoura a foreign key → 500 genérico.
export function assertRefs(db: DemoDb, accountId: string, categoryId: string): void {
  const accountOk = db.accounts.some((a) => a.id === accountId);
  const categoryOk = db.categories.some((c) => c.id === categoryId);
  if (!accountOk || !categoryOk) throw internalError();
}
```

- [ ] **Passo 2: criar `web/src/demo/handlers/accounts.ts`**

```ts
import type { Account } from '@/types/entities';
import { internalError, invalid } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseIntInRange,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/account.service,validators/account.schema}.ts.

const TIPOS = ['CONTA_CORRENTE', 'DINHEIRO', 'CARTAO_CREDITO'] as const;
const NOT_FOUND = 'Conta não encontrada';

// Refine do schema: tipo CARTAO_CREDITO exige limite, diaFechamento e diaVencimento no mesmo body.
function parseCardFields(
  body: Record<string, unknown>,
  tipo: Account['tipo'] | undefined,
) {
  const limite = optionalField(body, 'limite', (v) =>
    parseMoney(v, { centavos: false }),
  );
  const diaFechamento = optionalField(body, 'diaFechamento', (v) =>
    parseIntInRange(v, 1, 31),
  );
  const diaVencimento = optionalField(body, 'diaVencimento', (v) =>
    parseIntInRange(v, 1, 31),
  );
  if (
    tipo === 'CARTAO_CREDITO' &&
    (limite === undefined ||
      diaFechamento === undefined ||
      diaVencimento === undefined)
  ) {
    throw invalid();
  }
  return { limite, diaFechamento, diaVencimento };
}

export function createAccount(
  db: DemoDb,
  body: Record<string, unknown>,
): Account {
  const nome = requireString(body.nome);
  const tipo = oneOf(body.tipo, TIPOS);
  const card = parseCardFields(body, tipo);
  const now = nowIso();
  const account: Account = {
    id: newId(),
    nome,
    tipo,
    limite: card.limite ?? null,
    diaFechamento: card.diaFechamento ?? null,
    diaVencimento: card.diaVencimento ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.accounts.push(account);
  return account;
}

function updateAccount(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Account {
  const tipo = optionalField(body, 'tipo', (v) => oneOf(v, TIPOS));
  const changes = definedOnly({
    nome: optionalField(body, 'nome', requireString),
    tipo,
    ...parseCardFields(body, tipo),
  });
  const account = findOr404(db.accounts, id, NOT_FOUND);
  Object.assign(account, changes, { updatedAt: nowIso() });
  return account;
}

function removeAccount(db: DemoDb, id: string): void {
  findOr404(db.accounts, id, NOT_FOUND);
  const emUso =
    db.transactions.some((t) => t.accountId === id) ||
    db.purchases.some((p) => p.accountId === id) ||
    db.fixedExpenses.some((f) => f.accountId === id);
  if (emUso) throw internalError();
  db.accounts = db.accounts.filter((a) => a.id !== id);
}

export const accountRoutes: Route[] = [
  { method: 'GET', pattern: '/accounts', handler: ({ db }) => db.accounts },
  {
    method: 'GET',
    pattern: '/accounts/:id',
    handler: ({ db, params }) => findOr404(db.accounts, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/accounts',
    handler: ({ db, body }) => createAccount(db, body),
  },
  {
    method: 'PUT',
    pattern: '/accounts/:id',
    handler: ({ db, params, body }) => updateAccount(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/accounts/:id',
    handler: ({ db, params }) => removeAccount(db, params.id),
  },
];
```

- [ ] **Passo 3: criar `web/src/demo/handlers/categories.ts`**

```ts
import type { Category } from '@/types/entities';
import { internalError } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  oneOf,
  optionalField,
  parseMoney,
  parseText,
  requireString,
} from './shared';

// Espelha backend/src/{services/category.service,validators/category.schema}.ts.

const TIPOS = ['RECEITA', 'DESPESA'] as const;
const NOT_FOUND = 'Categoria não encontrada';

// metaMensal: null explícito remove a meta; ausente não altera (no create vira null).
function parseMeta(value: unknown): string | null {
  return value === null ? null : parseMoney(value, { centavos: false });
}

function createCategory(db: DemoDb, body: Record<string, unknown>): Category {
  const category: Category = {
    id: newId(),
    nome: requireString(body.nome),
    tipo: oneOf(body.tipo, TIPOS),
    icone: optionalField(body, 'icone', parseText) ?? null,
    cor: optionalField(body, 'cor', parseText) ?? null,
    metaMensal: optionalField(body, 'metaMensal', parseMeta) ?? null,
  };
  db.categories.push(category);
  return category;
}

function updateCategory(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Category {
  const changes = definedOnly({
    nome: optionalField(body, 'nome', requireString),
    tipo: optionalField(body, 'tipo', (v) => oneOf(v, TIPOS)),
    icone: optionalField(body, 'icone', parseText),
    cor: optionalField(body, 'cor', parseText),
    metaMensal: optionalField(body, 'metaMensal', parseMeta),
  });
  // definedOnly só descarta undefined: metaMensal null (remover a meta) passa adiante.
  const category = findOr404(db.categories, id, NOT_FOUND);
  Object.assign(category, changes);
  return category;
}

function removeCategory(db: DemoDb, id: string): void {
  findOr404(db.categories, id, NOT_FOUND);
  const emUso =
    db.transactions.some((t) => t.categoryId === id) ||
    db.purchases.some((p) => p.categoryId === id) ||
    db.fixedExpenses.some((f) => f.categoryId === id);
  if (emUso) throw internalError();
  db.categories = db.categories.filter((c) => c.id !== id);
}

export const categoryRoutes: Route[] = [
  { method: 'GET', pattern: '/categories', handler: ({ db }) => db.categories },
  {
    method: 'GET',
    pattern: '/categories/:id',
    handler: ({ db, params }) => findOr404(db.categories, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/categories',
    handler: ({ db, body }) => createCategory(db, body),
  },
  {
    method: 'PUT',
    pattern: '/categories/:id',
    handler: ({ db, params, body }) => updateCategory(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/categories/:id',
    handler: ({ db, params }) => removeCategory(db, params.id),
  },
];
```

- [ ] **Passo 4: criar `web/src/demo/handlers/transactions.ts`**

```ts
import type { Transaction } from '@/types/entities';
import { DemoHttpError } from '../errors';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  assertRefs,
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseDate,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/transaction.service,validators/transaction.schema}.ts.

const TIPOS = ['RECEITA', 'DESPESA'] as const;
const NOT_FOUND = 'Transação não encontrada';
const PARCELADA =
  'Transação de compra parcelada não pode ser editada diretamente';

export function createTransaction(
  db: DemoDb,
  body: Record<string, unknown>,
): Transaction {
  const transaction: Transaction = {
    id: newId(),
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valor: parseMoney(body.valor),
    descricao: requireString(body.descricao),
    data: parseDate(body.data),
    tipo: oneOf(body.tipo, TIPOS),
    purchaseId: null,
    fixedExpenseId: null,
    parcelaNumero: null,
    parcelaTotal: null,
    createdAt: nowIso(),
  };
  assertRefs(db, transaction.accountId, transaction.categoryId);
  db.transactions.push(transaction);
  return transaction;
}

function updateTransaction(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Transaction {
  const changes = definedOnly({
    accountId: optionalField(body, 'accountId', requireString),
    categoryId: optionalField(body, 'categoryId', requireString),
    valor: optionalField(body, 'valor', (v) => parseMoney(v)),
    descricao: optionalField(body, 'descricao', requireString),
    data: optionalField(body, 'data', parseDate),
    tipo: optionalField(body, 'tipo', (v) => oneOf(v, TIPOS)),
  });
  const transaction = findOr404(db.transactions, id, NOT_FOUND);
  if (transaction.purchaseId) throw new DemoHttpError(400, PARCELADA);
  assertRefs(
    db,
    changes.accountId ?? transaction.accountId,
    changes.categoryId ?? transaction.categoryId,
  );
  Object.assign(transaction, changes);
  return transaction;
}

function removeTransaction(db: DemoDb, id: string): void {
  const transaction = findOr404(db.transactions, id, NOT_FOUND);
  if (transaction.purchaseId) throw new DemoHttpError(400, PARCELADA);
  db.transactions = db.transactions.filter((t) => t.id !== id);
}

export const transactionRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/transactions',
    handler: ({ db }) => db.transactions,
  },
  {
    method: 'GET',
    pattern: '/transactions/:id',
    handler: ({ db, params }) =>
      findOr404(db.transactions, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/transactions',
    handler: ({ db, body }) => createTransaction(db, body),
  },
  {
    method: 'PUT',
    pattern: '/transactions/:id',
    handler: ({ db, params, body }) => updateTransaction(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/transactions/:id',
    handler: ({ db, params }) => removeTransaction(db, params.id),
  },
];
```

- [ ] **Passo 5: registrar as rotas em `web/src/demo/routes.ts`**

```ts
import { accountRoutes } from './handlers/accounts';
import { categoryRoutes } from './handlers/categories';
import { transactionRoutes } from './handlers/transactions';
import type { Route } from './router';

// Tabela de endpoints da API falsa — um bloco por entidade, espelhando backend/src/routes/.
export const routes: Route[] = [
  ...accountRoutes,
  ...categoryRoutes,
  ...transactionRoutes,
];
```

- [ ] **Passo 6: CHECK e conferência rápida**

Rode o CHECK (esperado: código 0). Depois suba o PREVIEW DEMO e abra `http://localhost:4173/categorias` no Playwright. O banco ainda está vazio, então:
- crie a categoria "Teste" (despesa)
- edite o nome para "Teste 2"
- recarregue a página e confira que "Teste 2" continua lá
- exclua a categoria

Em `/cartoes`, crie uma conta corrente e um cartão. Nenhum toast de erro deve aparecer. Pare o preview.

- [ ] **Passo 7: commit**

```bash
git add web/src/demo
git commit -m "feat(web): handlers da demo para contas, categorias e transações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Handlers de compras parceladas e gastos fixos

**Arquivos:**
- Criar: `web/src/demo/handlers/purchases.ts`, `web/src/demo/handlers/fixed-expenses.ts`
- Modificar: `web/src/demo/routes.ts`

**Interfaces:**
- Consome: helpers de `shared.ts` (Task 3), `generateInstallments`, `generateFixedExpenseTransactions` e `addMonthsClamped` (Task 2)
- Produz:
  - `purchaseRoutes` e `createPurchase(db, body): Purchase`
  - `fixedExpenseRoutes`, `createFixedExpense(db, body): FixedExpense` e `ensureHorizon(db, agora: Date): void`

- [ ] **Passo 1: criar `web/src/demo/handlers/purchases.ts`**

```ts
import type { Purchase, Transaction } from '@/types/entities';
import { generateInstallments } from '../logic/purchase-installments';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  assertRefs,
  findOr404,
  newId,
  nowIso,
  parseDate,
  parseIntInRange,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/purchase.service,repositories/purchase.repository}.ts.

const NOT_FOUND = 'Compra não encontrada';

// createPurchaseSchema — usado tanto no POST quanto no PUT (o PUT exige o body completo).
function parsePurchase(body: Record<string, unknown>) {
  return {
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valorTotal: parseMoney(body.valorTotal),
    descricao: requireString(body.descricao),
    dataCompra: parseDate(body.dataCompra),
    numeroParcelas: parseIntInRange(
      body.numeroParcelas,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

function installmentTransactions(purchase: Purchase): Transaction[] {
  const createdAt = nowIso();
  return generateInstallments({
    valorTotal: purchase.valorTotal,
    numeroParcelas: purchase.numeroParcelas,
    dataCompra: new Date(purchase.dataCompra),
  }).map((parcela) => ({
    id: newId(),
    accountId: purchase.accountId,
    categoryId: purchase.categoryId,
    valor: parcela.valor.toString(),
    descricao: purchase.descricao,
    data: parcela.data.toISOString(),
    tipo: 'DESPESA',
    purchaseId: purchase.id,
    fixedExpenseId: null,
    parcelaNumero: parcela.parcelaNumero,
    parcelaTotal: parcela.parcelaTotal,
    createdAt,
  }));
}

export function createPurchase(
  db: DemoDb,
  body: Record<string, unknown>,
): Purchase {
  const input = parsePurchase(body);
  assertRefs(db, input.accountId, input.categoryId);
  const purchase: Purchase = { id: newId(), ...input, createdAt: nowIso() };
  db.purchases.push(purchase);
  db.transactions.push(...installmentTransactions(purchase));
  return purchase;
}

function updatePurchase(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Purchase {
  const input = parsePurchase(body);
  const purchase = findOr404(db.purchases, id, NOT_FOUND);
  assertRefs(db, input.accountId, input.categoryId);
  Object.assign(purchase, input);
  db.transactions = db.transactions.filter((t) => t.purchaseId !== id);
  db.transactions.push(...installmentTransactions(purchase));
  return purchase;
}

function removePurchase(db: DemoDb, id: string): void {
  findOr404(db.purchases, id, NOT_FOUND);
  db.transactions = db.transactions.filter((t) => t.purchaseId !== id);
  db.purchases = db.purchases.filter((p) => p.id !== id);
}

export const purchaseRoutes: Route[] = [
  { method: 'GET', pattern: '/purchases', handler: ({ db }) => db.purchases },
  {
    method: 'GET',
    pattern: '/purchases/:id',
    handler: ({ db, params }) => findOr404(db.purchases, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/purchases',
    handler: ({ db, body }) => createPurchase(db, body),
  },
  {
    method: 'PUT',
    pattern: '/purchases/:id',
    handler: ({ db, params, body }) => updatePurchase(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/purchases/:id',
    handler: ({ db, params }) => removePurchase(db, params.id),
  },
];
```

- [ ] **Passo 2: criar `web/src/demo/handlers/fixed-expenses.ts`**

```ts
import type { Transaction } from '@/types/entities';
import {
  addMonthsClamped,
  generateFixedExpenseTransactions,
} from '../logic/fixed-expense-generator';
import type { Route } from '../router';
import type { DemoDb, FixedExpense } from '../types';
import {
  assertRefs,
  findOr404,
  newId,
  nowIso,
  parseDate,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/fixed-expense.service,repositories/fixed-expense.repository}.ts.

const HORIZON_MONTHS = 12;
const NOT_FOUND = 'Despesa fixa não encontrada';

function fixedTransaction(
  expense: FixedExpense,
  valor: string,
  data: Date,
): Transaction {
  return {
    id: newId(),
    accountId: expense.accountId,
    categoryId: expense.categoryId,
    valor,
    descricao: expense.descricao,
    data: data.toISOString(),
    tipo: 'DESPESA',
    purchaseId: null,
    fixedExpenseId: expense.id,
    parcelaNumero: null,
    parcelaTotal: null,
    createdAt: nowIso(),
  };
}

export function createFixedExpense(
  db: DemoDb,
  body: Record<string, unknown>,
): FixedExpense {
  const expense: FixedExpense = {
    id: newId(),
    accountId: requireString(body.accountId),
    categoryId: requireString(body.categoryId),
    valor: parseMoney(body.valor),
    descricao: requireString(body.descricao),
    dataInicio: parseDate(body.dataInicio),
    status: 'ACTIVE',
    createdAt: nowIso(),
  };
  assertRefs(db, expense.accountId, expense.categoryId);
  db.fixedExpenses.push(expense);
  const geradas = generateFixedExpenseTransactions({
    valor: expense.valor,
    dataInicio: new Date(expense.dataInicio),
    quantidadeMeses: HORIZON_MONTHS,
  });
  for (const t of geradas) {
    db.transactions.push(fixedTransaction(expense, t.valor.toString(), t.data));
  }
  return expense;
}

// Cancela (soft-delete): apaga só as transações com data ≥ hoje (UTC) e desativa os
// lembretes ligados — mesmo comportamento de fixedExpenseService.remove.
function removeFixedExpense(db: DemoDb, id: string): void {
  const expense = findOr404(db.fixedExpenses, id, NOT_FOUND);
  const agora = new Date();
  const hojeUTC = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  );
  db.transactions = db.transactions.filter(
    (t) => !(t.fixedExpenseId === id && new Date(t.data) >= hojeUTC),
  );
  expense.status = 'CANCELED';
  const now = nowIso();
  for (const reminder of db.reminders) {
    if (reminder.fixedExpenseId === id) {
      reminder.ativo = false;
      reminder.updatedAt = now;
    }
  }
}

// Port de fixedExpenseService.ensureHorizon (no backend: cron diário + startup). Continua a
// partir da última transação gerada — inclusive o drift de dia 31 → 28 descrito no spec.
export function ensureHorizon(db: DemoDb, agora: Date): void {
  const targetDate = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + HORIZON_MONTHS, 1),
  );
  for (const expense of db.fixedExpenses) {
    if (expense.status !== 'ACTIVE') continue;
    const datas = db.transactions
      .filter((t) => t.fixedExpenseId === expense.id)
      .map((t) => new Date(t.data).getTime());
    if (datas.length === 0) continue;

    let current = addMonthsClamped(new Date(Math.max(...datas)), 1);
    while (current <= targetDate) {
      db.transactions.push(fixedTransaction(expense, expense.valor, current));
      current = addMonthsClamped(current, 1);
    }
  }
}

export const fixedExpenseRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/fixed-expenses',
    handler: ({ db }) => db.fixedExpenses,
  },
  {
    method: 'GET',
    pattern: '/fixed-expenses/:id',
    handler: ({ db, params }) =>
      findOr404(db.fixedExpenses, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/fixed-expenses',
    handler: ({ db, body }) => createFixedExpense(db, body),
  },
  {
    method: 'DELETE',
    pattern: '/fixed-expenses/:id',
    handler: ({ db, params }) => removeFixedExpense(db, params.id),
  },
];
```

- [ ] **Passo 3: registrar as rotas em `web/src/demo/routes.ts`**

Acrescente os imports e os spreads no fim do array:

```ts
import { fixedExpenseRoutes } from './handlers/fixed-expenses';
import { purchaseRoutes } from './handlers/purchases';
```

```ts
  ...purchaseRoutes,
  ...fixedExpenseRoutes,
```

- [ ] **Passo 4: CHECK e conferência rápida**

Rode o CHECK (esperado: código 0). No PREVIEW DEMO, com a conta e o cartão criados na Task 3 (ou crie de novo):
- crie uma compra parcelada de R$ 100,00 em 3x no cartão e confira no Extrato as parcelas 33,33 / 33,33 / 33,34 nos 3 meses
- crie uma despesa fixa pelo formulário de transação e confira que ela aparece nos meses seguintes
- exclua o gasto fixo pelo Extrato e confira que as ocorrências futuras somem e as passadas ficam

- [ ] **Passo 5: commit**

```bash
git add web/src/demo
git commit -m "feat(web): handlers da demo para compras parceladas e gastos fixos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Handlers de lembretes, push e relatórios

**Arquivos:**
- Criar: `web/src/demo/handlers/reminders.ts`, `web/src/demo/handlers/push.ts`, `web/src/demo/handlers/reports.ts`
- Modificar: `web/src/demo/routes.ts`

**Interfaces:**
- Consome: helpers de `shared.ts` (Task 3), `calcularProximoDisparo` e as funções de `report-calculations` (Task 2)
- Produz:
  - `reminderRoutes`, `createReminder(db, body, agora?: Date): Reminder` e `advanceDueReminders(db, agora: Date): void`
  - `pushRoutes` e `reportRoutes`

- [ ] **Passo 1: criar `web/src/demo/handlers/reminders.ts`**

```ts
import type { Reminder } from '@/types/entities';
import { DemoHttpError, invalid } from '../errors';
import { calcularProximoDisparo } from '../logic/reminder-schedule';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseDate,
  parseIntInRange,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/reminder.service,validators/reminder.schema}.ts.

// Default de REMINDERS_TZ no backend.
const TZ = 'America/Sao_Paulo';
const NOT_FOUND = 'Lembrete não encontrado';
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

type ScheduleFields = Pick<
  Reminder,
  'recorrencia' | 'diaDoMes' | 'dataUnica' | 'horario' | 'diasAntecedencia'
>;

function proximoDisparo(fields: ScheduleFields, agora: Date): string | null {
  const disparo = calcularProximoDisparo(
    { ...fields, dataUnica: fields.dataUnica ? new Date(fields.dataUnica) : null },
    agora,
    TZ,
  );
  return disparo ? disparo.toISOString() : null;
}

function mensagemErroRecorrencia(data: {
  recorrencia?: string;
  diaDoMes?: number | null;
  dataUnica?: string | null;
}): string | null {
  if (data.recorrencia === 'MENSAL' && !data.diaDoMes) {
    return 'diaDoMes é obrigatório para lembretes mensais';
  }
  if (data.recorrencia === 'UNICO' && !data.dataUnica) {
    return 'dataUnica é obrigatória para lembretes únicos';
  }
  return null;
}

function parseReminderFields(body: Record<string, unknown>) {
  return definedOnly({
    titulo: optionalField(body, 'titulo', requireString),
    tipo: optionalField(body, 'tipo', (v) =>
      oneOf(v, ['ENTRADA', 'SAIDA'] as const),
    ),
    valor: optionalField(body, 'valor', (v) =>
      v === null ? null : parseMoney(v),
    ),
    recorrencia: optionalField(body, 'recorrencia', (v) =>
      oneOf(v, ['MENSAL', 'UNICO'] as const),
    ),
    diaDoMes: optionalField(body, 'diaDoMes', (v) =>
      v === null ? null : parseIntInRange(v, 1, 31),
    ),
    dataUnica: optionalField(body, 'dataUnica', (v) =>
      v === null ? null : parseDate(v),
    ),
    horario: optionalField(body, 'horario', (v) => {
      if (typeof v !== 'string' || !HORARIO.test(v)) throw invalid();
      return v;
    }),
    diasAntecedencia: optionalField(body, 'diasAntecedencia', (v) =>
      parseIntInRange(v, 0, 7),
    ),
    ativo: optionalField(body, 'ativo', (v) => {
      if (typeof v !== 'boolean') throw invalid();
      return v;
    }),
    fixedExpenseId: optionalField(body, 'fixedExpenseId', (v) =>
      v === null ? null : requireString(v),
    ),
  });
}

export function createReminder(
  db: DemoDb,
  body: Record<string, unknown>,
  agora = new Date(),
): Reminder {
  const data = parseReminderFields(body);
  if (!data.titulo || !data.tipo || !data.recorrencia) throw invalid();
  // No create a regra é um superRefine do Zod → 400 "Dados inválidos".
  if (mensagemErroRecorrencia(data)) throw invalid();

  const fields: ScheduleFields = {
    recorrencia: data.recorrencia,
    diaDoMes: data.recorrencia === 'MENSAL' ? (data.diaDoMes ?? null) : null,
    dataUnica: data.recorrencia === 'UNICO' ? (data.dataUnica ?? null) : null,
    horario: data.horario ?? '09:00',
    diasAntecedencia: data.diasAntecedencia ?? 0,
  };
  const now = nowIso();
  const reminder: Reminder = {
    id: newId(),
    titulo: data.titulo,
    tipo: data.tipo,
    valor: data.valor ?? null,
    ...fields,
    ativo: data.ativo ?? true,
    proximoDisparo: proximoDisparo(fields, agora),
    ultimoDisparo: null,
    fixedExpenseId: data.fixedExpenseId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.reminders.push(reminder);
  return reminder;
}

function updateReminder(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Reminder {
  const data = parseReminderFields(body);
  const atual = findOr404(db.reminders, id, NOT_FOUND);
  const merged = { ...atual, ...data };
  // No update a regra roda sobre o registro mesclado → AppError 400 com a mensagem.
  const erro = mensagemErroRecorrencia(merged);
  if (erro) throw new DemoHttpError(400, erro);

  const fields: ScheduleFields = {
    recorrencia: merged.recorrencia,
    diaDoMes: merged.recorrencia === 'MENSAL' ? merged.diaDoMes : null,
    dataUnica: merged.recorrencia === 'UNICO' ? merged.dataUnica : null,
    horario: merged.horario,
    diasAntecedencia: merged.diasAntecedencia,
  };
  // Recalcula sempre a partir de agora: reativar um lembrete não dispara os perdidos.
  Object.assign(atual, data, fields, {
    proximoDisparo: proximoDisparo(fields, new Date()),
    updatedAt: nowIso(),
  });
  return atual;
}

function removeReminder(db: DemoDb, id: string): void {
  findOr404(db.reminders, id, NOT_FOUND);
  db.reminders = db.reminders.filter((r) => r.id !== id);
}

// orderBy [{ ativo: 'desc' }, { proximoDisparo: 'asc' }] — SQLite põe NULL primeiro em ASC.
function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    if (a.proximoDisparo === b.proximoDisparo) return 0;
    if (a.proximoDisparo === null) return -1;
    if (b.proximoDisparo === null) return 1;
    return a.proximoDisparo.localeCompare(b.proximoDisparo);
  });
}

// O que reminderService.dispatchDue faz, menos o envio: na demo nenhum canal existe.
export function advanceDueReminders(db: DemoDb, agora: Date): void {
  for (const reminder of db.reminders) {
    if (!reminder.ativo || reminder.proximoDisparo === null) continue;
    if (new Date(reminder.proximoDisparo) > agora) continue;
    reminder.ultimoDisparo = agora.toISOString();
    reminder.proximoDisparo = proximoDisparo(reminder, agora);
  }
}

export const reminderRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/reminders',
    handler: ({ db }) => sortReminders(db.reminders),
  },
  {
    method: 'GET',
    pattern: '/reminders/:id',
    handler: ({ db, params }) => findOr404(db.reminders, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/reminders',
    handler: ({ db, body }) => createReminder(db, body),
  },
  {
    method: 'PUT',
    pattern: '/reminders/:id',
    handler: ({ db, params, body }) => updateReminder(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/reminders/:id',
    handler: ({ db, params }) => removeReminder(db, params.id),
  },
  {
    // Mesmo retorno do backend sem DISCORD_WEBHOOK_URL nem VAPID configurados.
    method: 'POST',
    pattern: '/reminders/:id/test',
    handler: ({ db, params }) => {
      findOr404(db.reminders, params.id, NOT_FOUND);
      return {
        canais: [
          { canal: 'discord', status: 'desativado' },
          { canal: 'web-push', status: 'desativado' },
        ],
      };
    },
  },
];
```

- [ ] **Passo 2: criar `web/src/demo/handlers/push.ts`**

```ts
import { DemoHttpError } from '../errors';
import type { Route } from '../router';

// Mesmo comportamento do backend sem chaves VAPID: use-push.ts cai em 'server-disabled'.
export const pushRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/push/config',
    handler: () => ({ enabled: false, publicKey: null }),
  },
  {
    method: 'POST',
    pattern: '/push/subscriptions',
    handler: () => {
      throw new DemoHttpError(503, 'Web Push não está configurado no servidor');
    },
  },
  {
    method: 'DELETE',
    pattern: '/push/subscriptions',
    handler: () => undefined,
  },
];
```

- [ ] **Passo 3: criar `web/src/demo/handlers/reports.ts`**

```ts
import Decimal from 'decimal.js';
import type { Transaction } from '@/types/entities';
import { DemoHttpError, internalError, invalid } from '../errors';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  currentMonthUTC,
  mesParaIntervalo,
  somarValores,
} from '../logic/report-calculations';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import { findOr404 } from './shared';

// Espelha backend/src/{services/reports.service,validators/reports.schema}.ts.

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMes(value: string | null): string {
  if (value === null || !MES.test(value)) throw invalid();
  return value;
}

function noIntervalo(t: Transaction, inicio: Date, fim: Date): boolean {
  const data = new Date(t.data);
  return data >= inicio && data < fim;
}

// O include { category, account } do reportsRepository.
function comRelacoes(db: DemoDb) {
  const accounts = new Map(db.accounts.map((a) => [a.id, a]));
  const categories = new Map(db.categories.map((c) => [c.id, c]));
  return (t: Transaction) => {
    const account = accounts.get(t.accountId);
    const category = categories.get(t.categoryId);
    if (!account || !category) throw internalError();
    return {
      tipo: t.tipo,
      valor: new Decimal(t.valor),
      accountId: t.accountId,
      categoryId: t.categoryId,
      account,
      category,
    };
  };
}

function dashboard(db: DemoDb, query: URLSearchParams) {
  const mesParam = query.get('mes');
  const mes = mesParam === null ? currentMonthUTC() : parseMes(mesParam);
  const { inicio, fim } = mesParaIntervalo(mes);
  const transactions = db.transactions
    .filter((t) => noIntervalo(t, inicio, fim))
    .map(comRelacoes(db));

  return {
    saldoMes: calcularSaldoMes(transactions).toString(),
    gastoPorCategoria: agruparGastoPorCategoria(
      transactions.filter((t) => t.tipo === 'DESPESA'),
    ).map((g) => ({ ...g, total: g.total.toString() })),
    faturaAtualPorCartao: agruparFaturaAtualPorCartao(
      transactions.filter((t) => t.account.tipo === 'CARTAO_CREDITO'),
    ).map((f) => ({ ...f, total: f.total.toString() })),
  };
}

function extrato(db: DemoDb, query: URLSearchParams): Transaction[] {
  const { inicio, fim } = mesParaIntervalo(parseMes(query.get('mes')));
  const categoriaId = query.get('categoriaId') || undefined;
  const accountId = query.get('accountId') || undefined;
  return db.transactions
    .filter(
      (t) =>
        noIntervalo(t, inicio, fim) &&
        (!categoriaId || t.categoryId === categoriaId) &&
        (!accountId || t.accountId === accountId),
    )
    .sort((a, b) => b.data.localeCompare(a.data));
}

function fatura(db: DemoDb, accountId: string) {
  const account = findOr404(db.accounts, accountId, 'Conta não encontrada');
  if (account.tipo !== 'CARTAO_CREDITO') {
    throw new DemoHttpError(400, 'Conta não é um cartão de crédito');
  }

  const hoje = new Date();
  const inicioMesAtual = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1),
  );
  const inicioProximoMes = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1),
  );

  const transactions = db.transactions
    .filter((t) => t.accountId === accountId && new Date(t.data) >= inicioMesAtual)
    .map((t) => ({
      valor: new Decimal(t.valor),
      data: new Date(t.data),
      fixedExpenseId: t.fixedExpenseId,
    }));
  const doMesAtual = transactions.filter((t) => t.data < inicioProximoMes);
  const futuras = transactions.filter((t) => t.data >= inicioProximoMes);

  const faturaAtual = somarValores(doMesAtual);
  // Gastos fixos futuros não abatem o limite (docs/api.md, Fixed Expenses).
  const limiteDisponivel = calcularLimiteDisponivel({
    limite: new Decimal(account.limite ?? 0),
    faturaAtual,
    faturasFuturas: agruparFaturasFuturas(
      futuras.filter((t) => !t.fixedExpenseId),
    ),
  });

  return {
    faturaAtual: faturaAtual.toString(),
    faturasFuturas: agruparFaturasFuturas(futuras).map((f) => ({
      mes: f.mes,
      total: f.total.toString(),
    })),
    limiteDisponivel: limiteDisponivel.toString(),
  };
}

export const reportRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/dashboard',
    handler: ({ db, query }) => dashboard(db, query),
  },
  {
    method: 'GET',
    pattern: '/extrato',
    handler: ({ db, query }) => extrato(db, query),
  },
  {
    method: 'GET',
    pattern: '/accounts/:id/fatura',
    handler: ({ db, params }) => fatura(db, params.id),
  },
];
```

- [ ] **Passo 4: registrar as rotas em `web/src/demo/routes.ts`**

Acrescente os imports e os spreads no fim do array:

```ts
import { pushRoutes } from './handlers/push';
import { reminderRoutes } from './handlers/reminders';
import { reportRoutes } from './handlers/reports';
```

```ts
  ...reminderRoutes,
  ...pushRoutes,
  ...reportRoutes,
```

- [ ] **Passo 5: CHECK e conferência rápida**

Rode o CHECK (esperado: código 0). No PREVIEW DEMO:
- Home: mostra saldo, gasto por categoria e fatura por cartão, coerentes com o que você cadastrou.
- Cartões: a fatura atual, as futuras e o limite disponível aparecem.
- Lembretes: crie um lembrete mensal e um único. Conferir que o "testar" mostra o toast "Nenhum canal enviou" com "não configurado" e que o push aparece como indisponível no servidor.

- [ ] **Passo 6: commit**

```bash
git add web/src/demo
git commit -m "feat(web): handlers da demo para lembretes, push e relatórios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Seed determinístico e jobs de "startup"

**Arquivos:**
- Reescrever: `web/src/demo/seed.ts`
- Criar: `web/src/demo/jobs.ts`
- Modificar: `web/src/demo/store.ts`

**Interfaces:**
- Consome: `createTransaction` (Task 3; contas e categorias do seed são montadas direto, com ids fixos); `createPurchase` e `createFixedExpense` (Task 4); `createReminder` (Task 5); `ensureHorizon` (Task 4); `advanceDueReminders` (Task 5); `setCardColorId` (`lib/card-colors.ts`, existente)
- Produz:
  - `createSeed(hoje: Date): DemoDb`, `DEMO_DB_VERSION` e `SEED_CARD_COLORS: Record<string, string>`
  - `runStartupJobs(db, agora): void`

- [ ] **Passo 1: reescrever `web/src/demo/seed.ts`**

```ts
import type { Account, Category } from '@/types/entities';
import { createFixedExpense } from './handlers/fixed-expenses';
import { createPurchase } from './handlers/purchases';
import { createReminder } from './handlers/reminders';
import { createTransaction } from './handlers/transactions';
import type { DemoDb } from './types';

// Bump ao mudar o formato do DemoDb ou o seed: bancos salvos com outra versão são descartados.
export const DEMO_DB_VERSION = 1;

// Ids fixos para contas/categorias: as cores dos cartões ficam fora da API (localStorage,
// lib/card-colors.ts) e precisam de um id estável para sobreviver ao reset.
const ACC = {
  principal: 'seed-conta-principal',
  carteira: 'seed-carteira',
  roxinho: 'seed-cartao-roxinho',
  laranjinha: 'seed-cartao-laranjinha',
} as const;

const CAT = {
  mercado: 'seed-cat-mercado',
  restaurantes: 'seed-cat-restaurantes',
  transporte: 'seed-cat-transporte',
  moradia: 'seed-cat-moradia',
  lazer: 'seed-cat-lazer',
  saude: 'seed-cat-saude',
  assinaturas: 'seed-cat-assinaturas',
  educacao: 'seed-cat-educacao',
  compras: 'seed-cat-compras',
  outros: 'seed-cat-outros',
  salario: 'seed-cat-salario',
  freela: 'seed-cat-freela',
} as const;

export const SEED_CARD_COLORS: Record<string, string> = {
  [ACC.roxinho]: 'roxo',
  [ACC.laranjinha]: 'laranja',
};

type ExpenseTemplate = {
  categoryId: string;
  accountId: string;
  descricoes: string[];
  min: number;
  max: number;
  vezesPorMes: number;
};

// ~24 despesas avulsas por mês. Restaurantes: 6 × no mínimo R$ 55 > meta de R$ 300, então a
// meta aparece estourada em todo mês do histórico.
const DESPESAS: ExpenseTemplate[] = [
  { categoryId: CAT.mercado, accountId: ACC.roxinho, descricoes: ['Supermercado', 'Hortifruti', 'Atacadão', 'Feira'], min: 150, max: 280, vezesPorMes: 4 },
  { categoryId: CAT.restaurantes, accountId: ACC.roxinho, descricoes: ['iFood', 'Restaurante japonês', 'Pizzaria', 'Almoço do trabalho', 'Hamburgueria', 'Padaria'], min: 55, max: 110, vezesPorMes: 6 },
  { categoryId: CAT.transporte, accountId: ACC.laranjinha, descricoes: ['Uber', '99', 'Combustível', 'Estacionamento'], min: 18, max: 60, vezesPorMes: 5 },
  { categoryId: CAT.lazer, accountId: ACC.laranjinha, descricoes: ['Cinema', 'Show', 'Bar com amigos'], min: 40, max: 180, vezesPorMes: 3 },
  { categoryId: CAT.saude, accountId: ACC.principal, descricoes: ['Farmácia', 'Consulta'], min: 30, max: 150, vezesPorMes: 2 },
  { categoryId: CAT.compras, accountId: ACC.roxinho, descricoes: ['Roupas', 'Presente', 'Livraria'], min: 60, max: 250, vezesPorMes: 2 },
  { categoryId: CAT.outros, accountId: ACC.carteira, descricoes: ['Café', 'Pastel na feira', 'Gorjeta'], min: 10, max: 50, vezesPorMes: 2 },
];

// mulberry32: PRNG determinístico — todo visitante (e todo reset) vê os mesmos valores.
function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// month pode sair de 0-11 (Date.UTC normaliza: -1 = dezembro do ano anterior); o dia é
// limitado ao último dia do mês.
function isoDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString();
}

export function createSeed(hoje: Date): DemoDb {
  const rng = createRng(20261011);
  const now = hoje.toISOString();
  const y = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  const db: DemoDb = {
    version: DEMO_DB_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    purchases: [],
    fixedExpenses: [],
    reminders: [],
  };

  const account = (
    id: string,
    nome: string,
    tipo: Account['tipo'],
    card?: { limite: string; diaFechamento: number; diaVencimento: number },
  ): Account => ({
    id,
    nome,
    tipo,
    limite: card?.limite ?? null,
    diaFechamento: card?.diaFechamento ?? null,
    diaVencimento: card?.diaVencimento ?? null,
    createdAt: now,
    updatedAt: now,
  });
  db.accounts.push(
    account(ACC.principal, 'Conta principal', 'CONTA_CORRENTE'),
    account(ACC.carteira, 'Carteira', 'DINHEIRO'),
    account(ACC.roxinho, 'Cartão Roxinho', 'CARTAO_CREDITO', { limite: '8000', diaFechamento: 3, diaVencimento: 10 }),
    account(ACC.laranjinha, 'Cartão Laranjinha', 'CARTAO_CREDITO', { limite: '4000', diaFechamento: 20, diaVencimento: 27 }),
  );

  // icone null → CategoryIcon escolhe o ícone pelo nome; emoji/chave só onde o nome não casa.
  const category = (
    id: string,
    nome: string,
    tipo: Category['tipo'],
    cor: string,
    extra: { icone?: string; metaMensal?: string } = {},
  ): Category => ({
    id,
    nome,
    tipo,
    cor,
    icone: extra.icone ?? null,
    metaMensal: extra.metaMensal ?? null,
  });
  db.categories.push(
    category(CAT.mercado, 'Mercado', 'DESPESA', '#22c55e', { metaMensal: '1200' }),
    category(CAT.restaurantes, 'Restaurantes', 'DESPESA', '#f97316', { metaMensal: '300' }),
    category(CAT.transporte, 'Transporte', 'DESPESA', '#3b82f6', { metaMensal: '400' }),
    category(CAT.moradia, 'Moradia', 'DESPESA', '#a855f7'),
    category(CAT.lazer, 'Lazer', 'DESPESA', '#ec4899'),
    category(CAT.saude, 'Saúde', 'DESPESA', '#ef4444'),
    category(CAT.assinaturas, 'Assinaturas', 'DESPESA', '#eab308'),
    category(CAT.educacao, 'Educação', 'DESPESA', '#14b8a6', { icone: '📚' }),
    category(CAT.compras, 'Compras', 'DESPESA', '#6366f1'),
    category(CAT.outros, 'Outros', 'DESPESA', '#64748b'),
    category(CAT.salario, 'Salário', 'RECEITA', '#10b981'),
    category(CAT.freela, 'Freela', 'RECEITA', '#0ea5e9', { icone: 'trabalho' }),
  );

  // Receitas: salário do histórico até o próximo mês; freela em meses alternados.
  for (let offset = -2; offset <= 1; offset++) {
    createTransaction(db, { accountId: ACC.principal, categoryId: CAT.salario, valor: '6500', descricao: 'Salário', data: isoDate(y, m + offset, 5), tipo: 'RECEITA' });
  }
  for (const offset of [-2, 0]) {
    createTransaction(db, { accountId: ACC.principal, categoryId: CAT.freela, valor: '1200', descricao: 'Freela — site institucional', data: isoDate(y, m + offset, 20), tipo: 'RECEITA' });
  }

  // Despesas avulsas nos 2 meses passados e no atual (o mês inteiro — dias à frente de hoje
  // aparecem como lançamentos agendados, garantindo movimento mesmo no dia 1º).
  const valor = (min: number, max: number) =>
    (Math.round((min + rng() * (max - min)) * 100) / 100).toFixed(2);
  for (let offset = -2; offset <= 0; offset++) {
    for (const tpl of DESPESAS) {
      for (let i = 0; i < tpl.vezesPorMes; i++) {
        createTransaction(db, {
          accountId: tpl.accountId,
          categoryId: tpl.categoryId,
          valor: valor(tpl.min, tpl.max),
          descricao: tpl.descricoes[Math.floor(rng() * tpl.descricoes.length)],
          data: isoDate(y, m + offset, 1 + Math.floor(rng() * 28)),
          tipo: 'DESPESA',
        });
      }
    }
  }

  // Compras parceladas em estágios diferentes: começando agora, no meio e na última parcela.
  createPurchase(db, { accountId: ACC.roxinho, categoryId: CAT.compras, valorTotal: '4800', descricao: 'Notebook', dataCompra: isoDate(y, m, 8), numeroParcelas: 10 });
  createPurchase(db, { accountId: ACC.laranjinha, categoryId: CAT.compras, valorTotal: '3600', descricao: 'Geladeira', dataCompra: isoDate(y, m - 5, 15), numeroParcelas: 12 });
  createPurchase(db, { accountId: ACC.roxinho, categoryId: CAT.educacao, valorTotal: '1800', descricao: 'Curso de inglês', dataCompra: isoDate(y, m - 5, 12), numeroParcelas: 6 });

  // Gastos fixos (geram 12 meses a partir do início, como no backend).
  const aluguel = createFixedExpense(db, { accountId: ACC.principal, categoryId: CAT.moradia, valor: '1800', descricao: 'Aluguel', dataInicio: isoDate(y, m - 2, 10) });
  createFixedExpense(db, { accountId: ACC.principal, categoryId: CAT.saude, valor: '119.90', descricao: 'Academia', dataInicio: isoDate(y, m - 2, 7) });
  createFixedExpense(db, { accountId: ACC.roxinho, categoryId: CAT.assinaturas, valor: '55.90', descricao: 'Streaming de vídeo', dataInicio: isoDate(y, m - 2, 15) });
  createFixedExpense(db, { accountId: ACC.laranjinha, categoryId: CAT.assinaturas, valor: '21.90', descricao: 'Streaming de música', dataInicio: isoDate(y, m - 2, 22) });

  // Lembretes: um ligado a gasto fixo, um mensal de entrada, um único no futuro.
  const daqui40Dias = new Date(Date.UTC(y, m, hoje.getUTCDate() + 40))
    .toISOString()
    .slice(0, 10);
  createReminder(db, { titulo: 'Pagar aluguel', tipo: 'SAIDA', valor: '1800', recorrencia: 'MENSAL', diaDoMes: 10, horario: '09:00', diasAntecedencia: 2, fixedExpenseId: aluguel.id }, hoje);
  createReminder(db, { titulo: 'Receber salário', tipo: 'ENTRADA', valor: '6500', recorrencia: 'MENSAL', diaDoMes: 5, horario: '08:00' }, hoje);
  createReminder(db, { titulo: 'Pagar IPVA', tipo: 'SAIDA', valor: '1450.30', recorrencia: 'UNICO', dataUnica: daqui40Dias, horario: '10:00', diasAntecedencia: 3 }, hoje);

  return db;
}
```

> O Prettier vai quebrar as linhas longas (objetos inline) no `pnpm format` do CHECK. Isso é esperado.

- [ ] **Passo 2: criar `web/src/demo/jobs.ts`**

```ts
import { ensureHorizon } from './handlers/fixed-expenses';
import { advanceDueReminders } from './handlers/reminders';
import type { DemoDb } from './types';

// No backend esses jobs rodam no startup e por cron; na demo, a cada carregamento do app —
// assim quem volta semanas depois ainda vê transações futuras e lembretes em dia.
export function runStartupJobs(db: DemoDb, agora: Date): void {
  ensureHorizon(db, agora);
  advanceDueReminders(db, agora);
}
```

- [ ] **Passo 3: ligar seed, cores e jobs em `web/src/demo/store.ts`**

Troque o import do seed e acrescente os novos:

```ts
import { setCardColorId } from '@/lib/card-colors';
import { persister, queryClient } from '@/lib/query-client';
import { runStartupJobs } from './jobs';
import { createSeed, DEMO_DB_VERSION, SEED_CARD_COLORS } from './seed';
import type { DemoDb } from './types';
```

Substitua `getDb` por:

```ts
export function getDb(): DemoDb {
  if (db) return db;
  let loaded = load();
  if (!loaded) {
    loaded = createSeed(new Date());
    for (const [accountId, colorId] of Object.entries(SEED_CARD_COLORS)) {
      setCardColorId(accountId, colorId);
    }
  }
  runStartupJobs(loaded, new Date());
  saveDb(loaded);
  db = loaded;
  return db;
}
```

- [ ] **Passo 4: CHECK**

Rode o CHECK. Esperado: código 0.

- [ ] **Passo 5: conferência no navegador (Playwright, PREVIEW DEMO)**

1. Abra `http://localhost:4173` numa aba anônima ou depois de limpar o `localStorage`. A Home precisa mostrar saldo, gasto por categoria (Restaurantes acima da meta) e fatura dos 2 cartões.
2. Em `/cartoes`, o Roxinho fica roxo e o Laranjinha fica laranja. As faturas futuras incluem as parcelas do Notebook e da Geladeira.
3. **Idempotência dos jobs (Foco 2):** rode `JSON.parse(localStorage.demoDb).transactions.length` no console, recarregue a página 2 vezes e rode de novo. O número precisa ser o mesmo.
4. **Versão antiga (Foco 3):** rode `localStorage.demoDb = JSON.stringify({ ...JSON.parse(localStorage.demoDb), version: 0, accounts: [] })` e recarregue. As contas do seed precisam voltar, sem erro no console.

- [ ] **Passo 6: commit**

```bash
git add web/src/demo
git commit -m "feat(web): seed determinístico e jobs de startup da demo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: UI do modo demo (auth, banner com reset, título)

**Arquivos:**
- Modificar: `web/src/lib/auth.ts`, `web/src/App.tsx`, `web/src/routes/TabsLayout.tsx`, `web/src/main.tsx`, `web/index.html`
- Criar: `web/src/components/demo-banner.tsx`

**Interfaces:**
- Consome: `IS_DEMO` e `DEMO_USER_NAME` (Task 1); `resetDemo()` (Task 1), sempre via `import()` dinâmico

- [ ] **Passo 1: bypass de auth em `web/src/lib/auth.ts`**

Adicione o import no topo:

```ts
import { DEMO_USER_NAME, IS_DEMO } from './demo-mode';
```

Troque `getUserName` e `isLoggedIn` por:

```ts
export function getUserName(): string | null {
  if (IS_DEMO) return DEMO_USER_NAME;
  return localStorage.getItem(NAME_KEY);
}
```

```ts
// Na demo não existe backend nem senha: o visitante entra direto.
export function isLoggedIn(): boolean {
  if (IS_DEMO) return true;
  return getToken() !== null;
}
```

- [ ] **Passo 2: `/login` redireciona na demo (`web/src/App.tsx`)**

Adicione `import { IS_DEMO } from './lib/demo-mode';` e troque a rota de login por:

```tsx
        <Route
          path="/login"
          element={IS_DEMO ? <Navigate to="/" replace /> : <Login />}
        />
```

- [ ] **Passo 3: criar `web/src/components/demo-banner.tsx`**

```tsx
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
```

- [ ] **Passo 4: renderizar o banner em `web/src/routes/TabsLayout.tsx`**

Adicione os imports:

```tsx
import { DemoBanner } from '../components/demo-banner';
import { IS_DEMO } from '../lib/demo-mode';
```

Coloque o banner entre o header mobile e o `<main>`. No mobile ele fica abaixo do `AppHeader`, que já trata a safe-area do iPhone; no desktop fica no topo da coluna de conteúdo:

```tsx
        <div className="md:hidden">
          <AppHeader />
        </div>
        {IS_DEMO && <DemoBanner />}
        <main className="flex-1 pb-28 md:pb-8 md:pt-8 px-4 relative">
```

- [ ] **Passo 5: título e meta description**

Em `web/index.html`, logo depois do `<title>`:

```html
    <meta
      name="description"
      content="Controle financeiro pessoal: entradas, saídas, cartão de crédito e compras parceladas."
    />
```

Em `web/src/main.tsx`, adicione `import { IS_DEMO } from './lib/demo-mode';` e, antes de `createRoot(...)`:

```tsx
if (IS_DEMO) {
  document.title = 'Meu Dinheirinho (demo)';
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      'content',
      'Demo interativa do Meu Dinheirinho, com dados fictícios salvos só no seu navegador.',
    );
}
```

- [ ] **Passo 6: CHECK e bundle de produção limpo (Foco 1)**

```bash
docker compose exec web sh -c "pnpm format && pnpm lint && pnpm build && pnpm build:demo"
docker compose exec web sh -c "pnpm build && ! grep -rl 'demo.local' dist && ! grep -rl 'seed-conta-principal' dist && echo PROD-LIMPO"
```

Esperado: código 0 e `PROD-LIMPO`. Se o grep achar `seed-conta-principal`, o `import('@/demo/store')` do banner não foi eliminado. Confira se a guarda `import.meta.env.MODE !== 'demo'` está inline, como no Passo 3.

- [ ] **Passo 7: conferência no navegador**

No PREVIEW DEMO:
- `/login` redireciona para `/`, a Home mostra "Olá, Visitante" e o banner aparece em mobile (390×844) e em desktop (1280×800).
- Em "Resetar dados" → "Resetar", a página recarrega com o seed original (crie uma transação antes e confira que ela some).
- O título da aba é "Meu Dinheirinho (demo)".

Depois, com o app normal (`docker compose up` e `http://localhost:5173`), confira que a tela de login continua aparecendo e que não há banner.

- [ ] **Passo 8: commit**

```bash
git add web/src web/index.html
git commit -m "feat(web): UI do modo demo (entrada direta, banner com reset, título)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Build, Vercel e CI

**Arquivos:**
- Criar: `web/vercel.json`
- Modificar: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Passo 1: criar `web/vercel.json`**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

(A Vercel serve os arquivos estáticos existentes antes de aplicar o rewrite, então assets e `sw.js` não são afetados.)

- [ ] **Passo 2: adicionar o build da demo no CI**

Em `.github/workflows/ci.yml` **e** em `.github/workflows/deploy.yml`, no job `web-ci`, logo depois do passo `Build`:

```yaml
      - name: Build (demo)
        run: pnpm build:demo
```

- [ ] **Passo 3: validar o YAML e commitar**

```bash
grep -n "build:demo" .github/workflows/ci.yml .github/workflows/deploy.yml
git add web/vercel.json .github/workflows
git commit -m "ci: build da demo no CI e rewrite de SPA na Vercel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Esperado: o grep mostra uma linha em cada arquivo. (A configuração do segundo projeto na Vercel é manual e fica documentada na Task 10.)

---

### Task 9: Roteiro de verificação manual e screenshots

**Arquivos:**
- Criar: `docs/screenshots/home.png`, `docs/screenshots/extrato.png`, `docs/screenshots/cartoes.png` e `docs/screenshots/home-desktop.png`

- [ ] **Passo 1: subir o PREVIEW DEMO limpo**

Rode o PREVIEW DEMO e abra `http://localhost:4173` no Playwright com o `localStorage` vazio.

- [ ] **Passo 2: percorrer o roteiro (viewport 390×844 e depois 1280×800)**

Marque cada item. Qualquer falha volta para a task que é dona do handler.

1. A Home abre direto com dados, "Olá, Visitante" e o banner.
2. Home: saldo do mês; gasto por categoria com Restaurantes acima da meta; fatura atual por cartão.
3. Extrato: trocar de mês (anterior e próximo), filtrar por categoria e por conta.
4. Cartões: carrossel com 2 cartões, itens da fatura atual, faturas futuras com as parcelas do Notebook (x/10) e limite disponível.
5. Categorias e Lembretes listam o seed. O lembrete "Pagar aluguel" mostra o próximo disparo.
6. Criar transação → saldo e extrato atualizam. Editar → valor muda. Excluir → some.
7. Criar compra parcelada → parcelas aparecem nas faturas futuras. Editar a compra (PUT) → as parcelas são recalculadas.
8. Cancelar o gasto fixo "Aluguel" pelo Extrato → as ocorrências futuras somem e o lembrete "Pagar aluguel" fica inativo.
9. **Foco 5:** excluir a categoria "Mercado" (em uso) mostra um toast de erro, e excluir o "Cartão Roxinho" mostra "Não é possível excluir uma conta com lançamentos".
10. **Foco 4:** abrir a edição de uma transação, mudar o valor, cancelar e conferir que o extrato mostra o valor original.
11. Recarregar a página mantém as mudanças. "Resetar dados" volta ao seed.
12. Abrir direto `http://localhost:4173/extrato` funciona. (A Vercel cobre isso em produção com o `vercel.json`; o `vite preview` já faz o fallback de SPA.)
13. Nenhum erro no console durante o roteiro.

- [ ] **Passo 3: capturar as screenshots para o README**

Depois de um "Resetar dados", capture com `browser_take_screenshot`:
- `docs/screenshots/home.png`, `extrato.png` e `cartoes.png` em 390×844
- `docs/screenshots/home-desktop.png` em 1280×800

- [ ] **Passo 4: conferir que a produção não regrediu**

Com `docker compose up` (api + web), em `http://localhost:5173`: o login por senha funciona, a Home carrega (leitura) e dá para criar e excluir uma transação (escrita). Não aparece banner.

- [ ] **Passo 5: commit**

```bash
git add docs/screenshots
git commit -m "docs: screenshots da demo para o README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pacote self-host e documentação

**Arquivos:**
- Criar: `LICENSE`
- Reescrever: `README.md`
- Modificar: `backend/.env.example`, `web/.env.example`, `docs/deployment.md` (tradução + seção Demo), `docs/web-architecture.md`, `CLAUDE.md`, `docs/README.md` (se listar arquivos), `docs/superpowers/specs/2026-10-11-app-publico-demo-design.md`
- Mover: `Meu Dinheirinho.dc.html` → `docs/design/Meu Dinheirinho.dc.html`

- [ ] **Passo 1: criar `LICENSE` (MIT)**

```text
MIT License

Copyright (c) 2026 Andrey Dantas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

(O texto da MIT fica em inglês, que é a versão canônica.)

- [ ] **Passo 2: neutralizar e traduzir os `.env.example`**

`backend/.env.example`: troque `AUTH_USER_NAME="Andrey"` por `AUTH_USER_NAME=""` e reescreva os comentários em pt-BR:

```bash
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
NODE_ENV=development

# Senha do login (single-user, texto puro — ver docs/web-architecture.md para o porquê)
AUTH_PASSWORD="change-me"
# Segredo aleatório de 32+ bytes para assinar os tokens. Gere com: openssl rand -base64 32
AUTH_TOKEN_SECRET="change-me"
# Nome exibido na saudação da Home ("Olá, Fulano"); opcional — vazio esconde a saudação.
AUTH_USER_NAME=""

# WebAuthn (Face ID/Touch ID): precisam bater com o domínio do FRONTEND, não do backend
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_RP_NAME="Meu Dinheirinho"
WEBAUTHN_ORIGIN="http://localhost:5173"

# Lembretes — fuso em que dia/horário dos lembretes são interpretados
REMINDERS_TZ="America/Sao_Paulo"
# URL pública do app web (link nas notificações do Discord); opcional
WEB_APP_URL="http://localhost:5173"
# Discord: URL de webhook do canal (Configurações do canal → Integrações → Webhooks); opcional
DISCORD_WEBHOOK_URL=""
# Web Push: gere com `npx web-push generate-vapid-keys`; sem as três, push fica desligado
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:voce@example.com"
```

`web/.env.example`:

```bash
# URL do backend. Para testar num iPhone físico, use o IP da sua máquina na rede local
# (não localhost — no aparelho, localhost é o próprio iPhone).
VITE_API_URL="http://localhost:3000"
```

- [ ] **Passo 3: mover o protótipo de design**

```bash
mkdir -p docs/design && git mv "Meu Dinheirinho.dc.html" "docs/design/Meu Dinheirinho.dc.html"
```

- [ ] **Passo 4: reescrever `README.md`**

Substitua o conteúdo por:

````markdown
# Meu Dinheirinho

App de controle financeiro pessoal: entradas e saídas, cartão de crédito com fatura e limite, compras parceladas, gastos fixos e lembretes. É um PWA que você instala no iPhone pelo Safari e hospeda você mesmo (self-hosted, single-user).

**[▶ Abrir a demo](https://SEU-PROJETO-DEMO.vercel.app)**: roda inteira no navegador, com dados fictícios; nada sai do seu dispositivo.

<p>
  <img src="docs/screenshots/home.png" alt="Home" width="240" />
  <img src="docs/screenshots/extrato.png" alt="Extrato" width="240" />
  <img src="docs/screenshots/cartoes.png" alt="Cartões" width="240" />
</p>

![Home no desktop](docs/screenshots/home-desktop.png)

## Funcionalidades

- **Lançamentos** de receitas e despesas por conta (conta corrente, dinheiro, cartão) e categoria.
- **Cartões de crédito** em carrossel estilo carteira, com fatura atual, faturas futuras e limite disponível.
- **Compras parceladas**: as parcelas são geradas automaticamente e o centavo do arredondamento vai para a última.
- **Gastos fixos e assinaturas**, gerados mês a mês; ao cancelar, o histórico é preservado.
- **Metas mensais por categoria**, com alerta quando são estouradas.
- **Lembretes** de contas a pagar e a receber, via Web Push e/ou Discord.
- **Face ID / Touch ID** (WebAuthn) para reabrir o app sem digitar a senha.
- **Uso offline (leitura)** e tema claro/escuro.

## Stack

| | |
|---|---|
| Backend | Node 24, Express, TypeScript, Prisma 7, SQLite |
| Web | Vite, React 19, TypeScript, TanStack Query, shadcn/ui, Tailwind, `vite-plugin-pwa` |
| Infra | Docker Compose (dev), Coolify (backend), Vercel (web), GitHub Actions |

## Rodando localmente

Pré-requisitos: Docker e Docker Compose.

```bash
cp backend/.env.example backend/.env   # defina AUTH_PASSWORD e AUTH_TOKEN_SECRET
cp web/.env.example web/.env
docker compose build
# Primeira vez: gera o client do Prisma e cria o banco SQLite (backend/prisma/dev.db)
docker compose run --rm --no-deps api sh -c "pnpm prisma generate && pnpm prisma migrate deploy"
docker compose up
```

- Web: http://localhost:5173 (entre com a `AUTH_PASSWORD`)
- API: http://localhost:3000

Ao atualizar o repositório (`git pull`), rode de novo o comando da primeira vez para aplicar migrations novas. Para mudar o schema: `docker compose exec api pnpm prisma migrate dev --name <nome>`.

### Só a demo (sem backend)

```bash
cd web && pnpm install && pnpm dev:demo
```

## Variáveis de ambiente

**Backend** (`backend/.env`):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Caminho do SQLite, ex. `file:./prisma/dev.db` |
| `AUTH_PASSWORD` | sim | Senha de login (single-user) |
| `AUTH_TOKEN_SECRET` | sim | Segredo para assinar tokens, gere com `openssl rand -base64 32` |
| `AUTH_USER_NAME` | não | Nome da saudação "Olá, {nome}" |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGIN` | sim | Face ID/Touch ID; precisam bater com o domínio do **frontend** |
| `REMINDERS_TZ` | não | Fuso dos lembretes (padrão `America/Sao_Paulo`) |
| `WEB_APP_URL` | não | URL pública do web, usada nos links das notificações |
| `DISCORD_WEBHOOK_URL` | não | Webhook para lembretes no Discord |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | não | Web Push, gere com `npx web-push generate-vapid-keys` |
| `PORT` / `NODE_ENV` | não | Padrão `3000` / `development` |

**Web** (`web/.env`):

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL do backend (usada no build) |

## Deploy

O guia completo de primeira configuração (backend no Coolify, web na Vercel, pipeline do GitHub Actions e projeto da demo) está em [`docs/deployment.md`](docs/deployment.md).

## Instalando no iPhone

Abra o app no Safari → Compartilhar → **Adicionar à Tela de Início**. Pontos de atenção:

- **Single-user**: cada instância tem uma senha só, sem cadastro.
- **Face ID/Touch ID** exige HTTPS e o domínio real (não funciona por IP da rede local).
- **Push** só funciona no app instalado, a partir do iOS 16.4, e com um build de produção.

Detalhes em [`docs/web-architecture.md`](docs/web-architecture.md).

## Documentação

- [`docs/api.md`](docs/api.md): referência da API
- [`docs/architecture.md`](docs/architecture.md): decisões do backend
- [`docs/web-architecture.md`](docs/web-architecture.md): decisões do web (PWA, auth, offline, modo demo)

## Licença

[MIT](LICENSE)
````

> O link `https://SEU-PROJETO-DEMO.vercel.app` é a única lacuna deliberada. Ele só existe depois de criar o projeto na Vercel (passo manual do usuário, ver a seção Demo do `deployment.md`). Antes do commit, pergunte ao usuário a URL. Se ainda não existir, mantenha o placeholder e registre isso no resumo final.

- [ ] **Passo 5: traduzir `docs/deployment.md` para pt-BR e adicionar a seção Demo**

Traduza o arquivo inteiro para pt-BR, mantendo a estrutura de seções, os comandos e os avisos (⚠️). Traduza também os títulos: "Visão geral", "Mudanças no backend que fazem isso funcionar", "Configuração inicial", "Como o pipeline funciona", "Verificação pós-deploy", "Corrigindo um deploy existente com o volume montado em `/app/prisma`" e "Pendência conhecida". Ao traduzir:
- Na seção "Pendência conhecida", remova o item sobre a seção "Deploy em produção" do `web-architecture.md`, que é resolvido no Passo 6.
- Acrescente na configuração inicial do backend uma linha mostrando como gerar o `AUTH_TOKEN_SECRET` (`openssl rand -base64 32`) e as chaves VAPID (`npx web-push generate-vapid-keys`).

Acrescente antes de "Como o pipeline funciona":

```markdown
## Demo (projeto separado na Vercel)

A demo é o mesmo `web/` construído com `--mode demo`: sem backend, com dados fictícios no `localStorage` de cada visitante (ver `docs/web-architecture.md#modo-demo`).

1. Na Vercel, **Add New → Project** e importe este mesmo repositório (um segundo projeto, ex. `meu-dinheirinho-demo`).
2. **Root Directory**: `web/`. Framework preset: Vite.
3. **Build Command**: `pnpm build:demo` (override). Output: `dist` (padrão).
4. **Não** configure `VITE_API_URL`: a demo não chama nenhuma API.
5. Deploy. A integração nativa com o GitHub faz deploy automático a cada push na `main`, igual ao projeto de produção.
6. Coloque a URL gerada no link "Abrir a demo" do `README.md`.

O `web/vercel.json` (rewrite de SPA) vale para os dois projetos: abrir direto um link como `/extrato` não dá 404.
```

- [ ] **Passo 6: atualizar `docs/web-architecture.md`**

1. Substitua a seção "## Deploy em produção (planejado, ainda não executado)" por:

```markdown
## Deploy em produção

O frontend é publicado na **Vercel** (integração nativa com o GitHub, root `web/`, `VITE_API_URL` apontando para o backend no Coolify). O passo a passo está em `docs/deployment.md`. O `web/vercel.json` faz o rewrite de SPA para que deep links não deem 404.
```

2. Antes de "## O que ainda não existe", acrescente:

```markdown
## Modo demo

Build especial do mesmo app, para portfólio: `pnpm dev:demo` / `pnpm build:demo` (= `vite --mode demo`). Não existe backend: o visitante entra direto (sem login, nome "Visitante"), e os dados ficam no `localStorage` dele (chave `demoDb`).

- **Ponto de troca**: o início de `apiFetch` (`lib/api.ts`). Com `import.meta.env.MODE === 'demo'`, ele delega para `demoFetch` (`src/demo/demo-fetch.ts`), que roteia `método + path` (`src/demo/router.ts` + `routes.ts`) para handlers em `src/demo/handlers/`. Nenhuma tela, hook ou query key sabe que está na demo.
- **Fidelidade**: os handlers espelham os services do backend (mesmos status e mensagens de erro, incluindo o 500 de foreign key ao excluir conta/categoria em uso). A lógica pura é portada em `src/demo/logic/` com `decimal.js`, a mesma lib do `Prisma.Decimal`, e o dinheiro sai como `"100.5"`, igual ao backend.
- **⚠️ Mudou regra de negócio ou contrato de endpoint no backend → espelhe em `src/demo/`** (handler e/ou `logic/`). Não há testes que detectem a divergência.
- **Seed** (`src/demo/seed.ts`): determinístico (PRNG com seed fixa) e relativo à data de hoje. Ao mudar o seed ou o formato do `DemoDb`, faça bump em `DEMO_DB_VERSION` para descartar bancos salvos antigos.
- **Jobs**: o equivalente ao startup do backend (`ensureHorizon` dos gastos fixos e avanço dos lembretes vencidos, sem notificar) roda a cada carregamento (`src/demo/jobs.ts`).
- **Fora do bundle de produção**: todo `import()` de `src/demo/` fica atrás de `import.meta.env.MODE === 'demo'` **escrito inline**, para o bundler eliminar o chunk. Para conferir: `pnpm build && grep -rl demo.local dist` não pode achar nada.
- **Push/lembretes**: `/push/config` responde desligado (`server-disabled` no `use-push.ts`) e "testar lembrete" responde que nenhum canal está configurado.
- **Reset**: banner no topo (`components/demo-banner.tsx`) → `resetDemo()`, que apaga o `demoDb` e o cache persistido do TanStack Query e recarrega a página.
```

3. Se o doc mencionar "sem framework de testes", mantenha. A decisão não mudou.

- [ ] **Passo 7: atualizar `CLAUDE.md`**

1. Na seção `## Web (`web/`)` → `### Commands`, acrescente depois de `pnpm preview`:

```bash
pnpm dev:demo                # demo sem backend (vite --mode demo) — ver "Demo mode" abaixo
pnpm build:demo              # build da demo (deploy no projeto Vercel separado)
```

2. No fim da seção `### Architecture` do Web, acrescente:

```markdown
**Demo mode** (`--mode demo`): `apiFetch` delegates to an in-browser fake API in `src/demo/` (handlers mirroring the backend services over a `localStorage` "database", pure logic ported to `src/demo/logic/` with `decimal.js`). **If you change a backend business rule or endpoint contract, mirror it in `src/demo/`** — nothing tests for drift. Every `import()` of `src/demo/` must sit behind an inline `import.meta.env.MODE === 'demo'` check so it's tree-shaken out of the production bundle. See `docs/web-architecture.md#modo-demo`.
```

3. Na seção "## Docker (root `docker-compose.yml`)", o compose atual só tem os serviços `api` e `web` (não existem `api-prod`, `web-prod` nem o profile `prod`). Remova a linha `docker compose --profile prod up --build` do bloco de comandos e o parágrafo sobre `api-prod`/`web-prod`, e explique em uma frase que as imagens de produção vêm do target `prod` de cada `Dockerfile` (usado pelo Coolify no backend). No `## Repository structure`, troque a menção de `docs/` para incluir `docs/design/` (protótipo de design) e `docs/screenshots/`.

- [ ] **Passo 8: atualizar o spec**

Em `docs/superpowers/specs/2026-10-11-app-publico-demo-design.md`:
- Seção 2, item **Flag**: troque `VITE_DEMO_MODE=true` / `import.meta.env.VITE_DEMO_MODE === 'true'` por "modo do Vite `demo` (`import.meta.env.MODE === 'demo'`), garantidamente eliminado no build normal".
- Seção 4: remova o item `web/.env.demo`. Os scripts passam a ser `vite --mode demo` e `tsc -b && vite build --mode demo`.
- Seção 2, banner: troque por "um banner no topo da coluna de conteúdo (abaixo do `AppHeader` no mobile)".
- Status no topo: `implementado`.

- [ ] **Passo 9: revisão e commit**

```bash
git grep -n "Andrey" -- ':!LICENSE' ':!docs/superpowers' ':!*.lock' ':!*lock.yaml'
git grep -n "profile prod"
```

Esperado: nenhum resultado no primeiro comando, fora menções legítimas que você decidir manter (avalie cada uma), e nenhum resultado no segundo.

```bash
git add -A LICENSE README.md backend/.env.example web/.env.example docs CLAUDE.md "Meu Dinheirinho.dc.html"
git commit -m "docs: pacote self-host (README, LICENSE, envs, deployment em pt-BR, modo demo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Passo 10: validar o quick start num clone limpo**

O container de dev do backend não roda migrations (`CMD pnpm dev`), e o bind mount `./backend:/app` esconde o `src/generated` gerado na imagem. Por isso o README manda rodar `prisma generate` + `migrate deploy` antes do primeiro `up`. Confirme que isso funciona do zero:

```bash
docker compose down
D=/private/tmp/claude-501/-Users-andreydantas-www-meu-dinheirinho/clone-teste
rm -rf "$D" && git clone . "$D" && cd "$D"
cp backend/.env.example backend/.env && cp web/.env.example web/.env
sed -i '' 's/AUTH_TOKEN_SECRET="change-me"/AUTH_TOKEN_SECRET="segredo-de-teste-com-mais-de-32-caracteres"/' backend/.env
docker compose -p md-clone build
docker compose -p md-clone run --rm --no-deps api sh -c "pnpm prisma generate && pnpm prisma migrate deploy"
docker compose -p md-clone up -d
curl -s localhost:3000/health
curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"password":"change-me"}'
```

Resultado esperado: `{"status":"ok"}` e um JSON com `token`, e `http://localhost:5173` mostra a tela de login. Se algum comando falhar, corrija a seção "Rodando localmente" do README com a sequência que funcionou e repita o teste. No fim, faça a limpeza:

```bash
docker compose -p md-clone down -v && cd - && rm -rf "$D"
docker compose up -d
```

Como o `git clone .` só leva o que está commitado, este passo vem depois do commit do Passo 9. Se precisar corrigir o README, faça um commit separado: `docs: corrige quick start do README`.
