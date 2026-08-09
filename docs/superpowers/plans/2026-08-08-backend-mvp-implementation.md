# Backend MVP (Account/Purchase/Transaction + relatórios + testes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining backend MVP surface — CRUD for `Account`, `Purchase`, `Transaction`, automatic installment generation, and the Dashboard/Extrato/Fatura read endpoints — with Vitest unit tests for services and pure business logic.

**Architecture:** Extend the existing layered pattern (`routes → controllers → services → repositories → validators`, only repositories import Prisma) already used by `Category`. Business logic that doesn't need Prisma (installment math, report aggregation, date/where-clause building) is extracted into pure, directly-testable functions.

**Tech Stack:** Express 5, TypeScript (CommonJS), Prisma 7 (`@prisma/adapter-pg`), Zod, Vitest.

## Global Constraints

- Use `pnpm`, not npm/yarn (`cd backend` before any package command).
- Only files under `src/repositories/` import `prisma` (`../lib/prisma`) or the generated client — services never touch Prisma directly.
- Money fields are `Prisma.Decimal` (from `../generated/prisma/client`), never treated as raw JS `number` in arithmetic — construct with `new Prisma.Decimal(...)` and use its methods (`.plus`, `.minus`, `.times`, `.dividedBy`, `.toDecimalPlaces`).
- The generated Prisma client has no `index.ts` — import from `../generated/prisma/client`, never from the directory.
- Follow the existing `category.*` files as the template for file shape, naming, and error handling (`AppError`, Zod `.parse` in controllers).
- Test files are colocated as `*.test.ts` next to the source file they test — no separate `tests/` tree.
- Unit tests cover **services (with repositories mocked) and pure functions only** — no integration tests against real Postgres, no HTTP-layer (supertest) tests in this plan.
- Run `pnpm exec tsc --noEmit` and `pnpm lint` after each task; both must be clean before committing.

---

### Task 1: Test tooling setup + installment generation logic

**Files:**
- Modify: `backend/package.json` (add `test`/`test:watch` scripts)
- Create: `backend/vitest.config.ts`
- Create: `backend/src/services/purchase-installments.ts`
- Test: `backend/src/services/purchase-installments.test.ts`

**Interfaces:**
- Produces: `generateInstallments(input: { valorTotal: Prisma.Decimal | number | string; numeroParcelas: number; dataCompra: Date }): Installment[]`, and the exported type `Installment = { valor: Prisma.Decimal; data: Date; parcelaNumero: number; parcelaTotal: number }`. Task 4 (Purchase) consumes this.

- [ ] **Step 1: Install Vitest**

Run: `cd backend && pnpm add -D vitest`

- [ ] **Step 2: Add test scripts to `backend/package.json`**

In the `"scripts"` block, add (keep existing scripts untouched):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the failing test — `backend/src/services/purchase-installments.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { generateInstallments } from './purchase-installments';

describe('generateInstallments', () => {
  it('splits the total across installments, adjusting the last one for rounding', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(100),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)), // 15/03/2026
    });

    expect(installments).toHaveLength(3);
    expect(installments[0].valor.toString()).toBe('33.33');
    expect(installments[1].valor.toString()).toBe('33.33');
    expect(installments[2].valor.toString()).toBe('33.34');

    const soma = installments.reduce((acc, i) => acc.plus(i.valor), new Prisma.Decimal(0));
    expect(soma.toString()).toBe('100');
  });

  it('sets parcelaNumero and parcelaTotal sequentially', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)),
    });

    expect(installments.map((i) => i.parcelaNumero)).toEqual([1, 2, 3]);
    expect(installments.every((i) => i.parcelaTotal === 3)).toBe(true);
  });

  it('repeats the purchase day-of-month for each installment date', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)), // 15/03/2026
    });

    expect(installments.map((i) => i.data.toISOString().slice(0, 10))).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
    ]);
  });

  it('clamps the day to the last valid day of shorter months', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 0, 31)), // 31/01/2026
    });

    expect(installments.map((i) => i.data.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('returns a single installment with the full amount when numeroParcelas is 1', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(150.5),
      numeroParcelas: 1,
      dataCompra: new Date(Date.UTC(2026, 5, 1)),
    });

    expect(installments).toHaveLength(1);
    expect(installments[0].valor.toString()).toBe('150.5');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test -- purchase-installments`
Expected: FAIL — `purchase-installments.ts` (and `generateInstallments`) don't exist yet.

- [ ] **Step 6: Implement `backend/src/services/purchase-installments.ts`**

```ts
import { Prisma } from '../generated/prisma/client';

export type Installment = {
  valor: Prisma.Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
};

export function generateInstallments(input: {
  valorTotal: Prisma.Decimal | number | string;
  numeroParcelas: number;
  dataCompra: Date;
}): Installment[] {
  const valorTotal = new Prisma.Decimal(input.valorTotal);
  const totalCentavos = valorTotal.times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);
  const centavosPorParcela = totalCentavos
    .dividedBy(input.numeroParcelas)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);

  const installments: Installment[] = [];
  let somaCentavos = new Prisma.Decimal(0);

  for (let i = 1; i <= input.numeroParcelas; i++) {
    const isUltima = i === input.numeroParcelas;
    const valorCentavos = isUltima ? totalCentavos.minus(somaCentavos) : centavosPorParcela;
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
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test -- purchase-installments`
Expected: PASS (5 tests)

- [ ] **Step 8: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/vitest.config.ts backend/src/services/purchase-installments.ts backend/src/services/purchase-installments.test.ts
git commit -m "test: add Vitest and installment generation logic"
```

---

### Task 2: Account CRUD

**Files:**
- Create: `backend/src/validators/account.schema.ts`
- Create: `backend/src/repositories/account.repository.ts`
- Create: `backend/src/services/account.service.ts`
- Test: `backend/src/services/account.service.test.ts`
- Create: `backend/src/controllers/account.controller.ts`
- Create: `backend/src/routes/account.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Produces: `accountRepository.findById(id): Promise<Account | null>` — consumed directly by Task 6 (`reportsService.fatura`).
- Produces: `CreateAccountInput`/`UpdateAccountInput` types (from `validators/account.schema.ts`).

- [ ] **Step 1: Create `backend/src/validators/account.schema.ts`**

```ts
import { z } from 'zod';

const baseAccountSchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  tipo: z.enum(['CONTA_CORRENTE', 'DINHEIRO', 'CARTAO_CREDITO']),
  limite: z.coerce.number().positive().optional(),
  diaFechamento: z.coerce.number().int().min(1).max(31).optional(),
  diaVencimento: z.coerce.number().int().min(1).max(31).optional(),
});

export const createAccountSchema = baseAccountSchema.refine(
  (data) =>
    data.tipo !== 'CARTAO_CREDITO' ||
    (data.limite !== undefined && data.diaFechamento !== undefined && data.diaVencimento !== undefined),
  {
    message: 'limite, diaFechamento e diaVencimento são obrigatórios para contas do tipo CARTAO_CREDITO',
    path: ['tipo'],
  },
);

export const updateAccountSchema = baseAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof baseAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

- [ ] **Step 2: Create `backend/src/repositories/account.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import type { CreateAccountInput, UpdateAccountInput } from '../validators/account.schema';

export const accountRepository = {
  findAll() {
    return prisma.account.findMany();
  },

  findById(id: string) {
    return prisma.account.findUnique({ where: { id } });
  },

  create(data: CreateAccountInput) {
    return prisma.account.create({ data });
  },

  update(id: string, data: UpdateAccountInput) {
    return prisma.account.update({ where: { id }, data });
  },

  remove(id: string) {
    return prisma.account.delete({ where: { id } });
  },
};
```

- [ ] **Step 3: Write the failing service tests — `backend/src/services/account.service.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountRepository } from '../repositories/account.repository';
import { AppError } from '../types/errors';
import { accountService } from './account.service';

vi.mock('../repositories/account.repository', () => ({
  accountRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() returns all accounts from the repository', async () => {
    const accounts = [{ id: '1', nome: 'Carteira' }];
    vi.mocked(accountRepository.findAll).mockResolvedValue(accounts as never);

    const result = await accountService.list();

    expect(result).toBe(accounts);
  });

  it('get() returns the account when it exists', async () => {
    const account = { id: '1', nome: 'Carteira' };
    vi.mocked(accountRepository.findById).mockResolvedValue(account as never);

    const result = await accountService.get('1');

    expect(result).toBe(account);
  });

  it('get() throws AppError 404 when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('update() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.update('missing', { nome: 'x' })).rejects.toThrow(AppError);
    expect(accountRepository.update).not.toHaveBeenCalled();
  });

  it('remove() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.remove('missing')).rejects.toThrow(AppError);
    expect(accountRepository.remove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test -- account.service`
Expected: FAIL — `account.service.ts` doesn't exist yet.

- [ ] **Step 5: Implement `backend/src/services/account.service.ts`**

```ts
import { accountRepository } from '../repositories/account.repository';
import { AppError } from '../types/errors';
import type { CreateAccountInput, UpdateAccountInput } from '../validators/account.schema';

export const accountService = {
  list() {
    return accountRepository.findAll();
  },

  async get(id: string) {
    const account = await accountRepository.findById(id);
    if (!account) throw new AppError('Conta não encontrada', 404);
    return account;
  },

  create(data: CreateAccountInput) {
    return accountRepository.create(data);
  },

  async update(id: string, data: UpdateAccountInput) {
    await this.get(id);
    return accountRepository.update(id, data);
  },

  async remove(id: string) {
    await this.get(id);
    return accountRepository.remove(id);
  },
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- account.service`
Expected: PASS (5 tests)

- [ ] **Step 7: Create `backend/src/controllers/account.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { accountService } from '../services/account.service';
import { createAccountSchema, updateAccountSchema } from '../validators/account.schema';

type IdParams = { id: string };

export const accountController = {
  async list(_req: Request, res: Response) {
    const accounts = await accountService.list();
    res.json(accounts);
  },

  async get(req: Request<IdParams>, res: Response) {
    const account = await accountService.get(req.params.id);
    res.json(account);
  },

  async create(req: Request, res: Response) {
    const data = createAccountSchema.parse(req.body);
    const account = await accountService.create(data);
    res.status(201).json(account);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateAccountSchema.parse(req.body);
    const account = await accountService.update(req.params.id, data);
    res.json(account);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await accountService.remove(req.params.id);
    res.status(204).send();
  },
};
```

- [ ] **Step 8: Create `backend/src/routes/account.routes.ts`**

```ts
import { Router } from 'express';
import { accountController } from '../controllers/account.controller';

export const accountRoutes = Router();

accountRoutes.get('/', accountController.list);
accountRoutes.get('/:id', accountController.get);
accountRoutes.post('/', accountController.create);
accountRoutes.put('/:id', accountController.update);
accountRoutes.delete('/:id', accountController.remove);
```

- [ ] **Step 9: Mount the routes in `backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import { accountRoutes } from './account.routes';
import { categoryRoutes } from './category.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/categories', categoryRoutes);
routes.use('/accounts', accountRoutes);
```

- [ ] **Step 10: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add backend/src/validators/account.schema.ts backend/src/repositories/account.repository.ts backend/src/services/account.service.ts backend/src/services/account.service.test.ts backend/src/controllers/account.controller.ts backend/src/routes/account.routes.ts backend/src/routes/index.ts
git commit -m "feat: add Account CRUD"
```

---

### Task 3: Transaction CRUD (blocking direct edits to parceled transactions)

**Files:**
- Create: `backend/src/validators/transaction.schema.ts`
- Create: `backend/src/repositories/transaction.repository.ts`
- Create: `backend/src/services/transaction.service.ts`
- Test: `backend/src/services/transaction.service.test.ts`
- Create: `backend/src/controllers/transaction.controller.ts`
- Create: `backend/src/routes/transaction.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: nothing from other tasks (independent CRUD slice). `Transaction` rows created by Task 4's `purchaseRepository.createWithInstallments` are read/written through this same repository's underlying table but via a separate code path — no direct code dependency.
- Produces: nothing consumed elsewhere in this plan.

- [ ] **Step 1: Create `backend/src/validators/transaction.schema.ts`**

```ts
import { z } from 'zod';

export const createTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valor: z.coerce.number().positive(),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  data: z.coerce.date(),
  tipo: z.enum(['RECEITA', 'DESPESA']),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

Note: `purchaseId`, `parcelaNumero`, `parcelaTotal` are intentionally **not** in this schema — those fields are only ever set by `purchaseService.create` (Task 4), never by direct client input.

- [ ] **Step 2: Create `backend/src/repositories/transaction.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import type { CreateTransactionInput, UpdateTransactionInput } from '../validators/transaction.schema';

export const transactionRepository = {
  findAll() {
    return prisma.transaction.findMany();
  },

  findById(id: string) {
    return prisma.transaction.findUnique({ where: { id } });
  },

  create(data: CreateTransactionInput) {
    return prisma.transaction.create({ data });
  },

  update(id: string, data: UpdateTransactionInput) {
    return prisma.transaction.update({ where: { id }, data });
  },

  remove(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },
};
```

- [ ] **Step 3: Write the failing service tests — `backend/src/services/transaction.service.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionRepository } from '../repositories/transaction.repository';
import { AppError } from '../types/errors';
import { transactionService } from './transaction.service';

vi.mock('../repositories/transaction.repository', () => ({
  transactionRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get() throws AppError 404 when the transaction does not exist', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(null);

    await expect(transactionService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('update() succeeds for a standalone transaction (purchaseId is null)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: null,
    } as never);
    const updated = { id: 't1', descricao: 'Novo valor' };
    vi.mocked(transactionRepository.update).mockResolvedValue(updated as never);

    const result = await transactionService.update('t1', { descricao: 'Novo valor' });

    expect(result).toBe(updated);
    expect(transactionRepository.update).toHaveBeenCalledWith('t1', { descricao: 'Novo valor' });
  });

  it('update() throws AppError 400 for a parceled transaction (purchaseId set)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: 'purchase-1',
    } as never);

    await expect(transactionService.update('t1', { descricao: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it('remove() succeeds for a standalone transaction (purchaseId is null)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: null,
    } as never);

    await transactionService.remove('t1');

    expect(transactionRepository.remove).toHaveBeenCalledWith('t1');
  });

  it('remove() throws AppError 400 for a parceled transaction (purchaseId set)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: 'purchase-1',
    } as never);

    await expect(transactionService.remove('t1')).rejects.toMatchObject({ status: 400 });
    expect(transactionRepository.remove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test -- transaction.service`
Expected: FAIL — `transaction.service.ts` doesn't exist yet.

- [ ] **Step 5: Implement `backend/src/services/transaction.service.ts`**

```ts
import { transactionRepository } from '../repositories/transaction.repository';
import { AppError } from '../types/errors';
import type { CreateTransactionInput, UpdateTransactionInput } from '../validators/transaction.schema';

export const transactionService = {
  list() {
    return transactionRepository.findAll();
  },

  async get(id: string) {
    const transaction = await transactionRepository.findById(id);
    if (!transaction) throw new AppError('Transação não encontrada', 404);
    return transaction;
  },

  create(data: CreateTransactionInput) {
    return transactionRepository.create(data);
  },

  async update(id: string, data: UpdateTransactionInput) {
    const transaction = await this.get(id);
    if (transaction.purchaseId) {
      throw new AppError('Transação de compra parcelada não pode ser editada diretamente', 400);
    }
    return transactionRepository.update(id, data);
  },

  async remove(id: string) {
    const transaction = await this.get(id);
    if (transaction.purchaseId) {
      throw new AppError('Transação de compra parcelada não pode ser editada diretamente', 400);
    }
    return transactionRepository.remove(id);
  },
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- transaction.service`
Expected: PASS (5 tests)

- [ ] **Step 7: Create `backend/src/controllers/transaction.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import { createTransactionSchema, updateTransactionSchema } from '../validators/transaction.schema';

type IdParams = { id: string };

export const transactionController = {
  async list(_req: Request, res: Response) {
    const transactions = await transactionService.list();
    res.json(transactions);
  },

  async get(req: Request<IdParams>, res: Response) {
    const transaction = await transactionService.get(req.params.id);
    res.json(transaction);
  },

  async create(req: Request, res: Response) {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await transactionService.create(data);
    res.status(201).json(transaction);
  },

  async update(req: Request<IdParams>, res: Response) {
    const data = updateTransactionSchema.parse(req.body);
    const transaction = await transactionService.update(req.params.id, data);
    res.json(transaction);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await transactionService.remove(req.params.id);
    res.status(204).send();
  },
};
```

- [ ] **Step 8: Create `backend/src/routes/transaction.routes.ts`**

```ts
import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';

export const transactionRoutes = Router();

transactionRoutes.get('/', transactionController.list);
transactionRoutes.get('/:id', transactionController.get);
transactionRoutes.post('/', transactionController.create);
transactionRoutes.put('/:id', transactionController.update);
transactionRoutes.delete('/:id', transactionController.remove);
```

- [ ] **Step 9: Mount the routes in `backend/src/routes/index.ts`**

Add the import and `routes.use('/transactions', transactionRoutes);` line, following the same shape as Task 2's Step 9.

- [ ] **Step 10: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add backend/src/validators/transaction.schema.ts backend/src/repositories/transaction.repository.ts backend/src/services/transaction.service.ts backend/src/services/transaction.service.test.ts backend/src/controllers/transaction.controller.ts backend/src/routes/transaction.routes.ts backend/src/routes/index.ts
git commit -m "feat: add Transaction CRUD with parceled-edit guard"
```

---

### Task 4: Purchase CRUD (installment generation + cascade delete)

**Files:**
- Create: `backend/src/validators/purchase.schema.ts`
- Create: `backend/src/repositories/purchase.repository.ts`
- Create: `backend/src/services/purchase.service.ts`
- Test: `backend/src/services/purchase.service.test.ts`
- Create: `backend/src/controllers/purchase.controller.ts`
- Create: `backend/src/routes/purchase.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: `generateInstallments` and the `Installment` type from Task 1 (`../services/purchase-installments`).
- Produces: nothing consumed elsewhere in this plan.

- [ ] **Step 1: Create `backend/src/validators/purchase.schema.ts`**

```ts
import { z } from 'zod';

export const createPurchaseSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valorTotal: z.coerce.number().positive(),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  dataCompra: z.coerce.date(),
  numeroParcelas: z.coerce.number().int().min(1),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
```

- [ ] **Step 2: Create `backend/src/repositories/purchase.repository.ts`**

```ts
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import type { CreatePurchaseInput } from '../validators/purchase.schema';

type InstallmentInput = {
  valor: Prisma.Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
};

export const purchaseRepository = {
  findAll() {
    return prisma.purchase.findMany();
  },

  findById(id: string) {
    return prisma.purchase.findUnique({ where: { id } });
  },

  createWithInstallments(data: CreatePurchaseInput, installments: InstallmentInput[]) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({ data });
      await tx.transaction.createMany({
        data: installments.map((installment) => ({
          accountId: data.accountId,
          categoryId: data.categoryId,
          valor: installment.valor,
          descricao: data.descricao,
          data: installment.data,
          tipo: 'DESPESA' as const,
          purchaseId: purchase.id,
          parcelaNumero: installment.parcelaNumero,
          parcelaTotal: installment.parcelaTotal,
        })),
      });
      return purchase;
    });
  },

  remove(id: string) {
    return prisma.$transaction([
      prisma.transaction.deleteMany({ where: { purchaseId: id } }),
      prisma.purchase.delete({ where: { id } }),
    ]);
  },
};
```

- [ ] **Step 3: Write the failing service tests — `backend/src/services/purchase.service.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { purchaseRepository } from '../repositories/purchase.repository';
import { AppError } from '../types/errors';
import { generateInstallments } from './purchase-installments';
import { purchaseService } from './purchase.service';

vi.mock('../repositories/purchase.repository', () => ({
  purchaseRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    createWithInstallments: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('./purchase-installments', () => ({
  generateInstallments: vi.fn(),
}));

describe('purchaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() generates installments and persists the purchase with them', async () => {
    const input = {
      accountId: 'acc1',
      categoryId: 'cat1',
      valorTotal: 100,
      descricao: 'Notebook',
      dataCompra: new Date('2026-03-15'),
      numeroParcelas: 3,
    };
    const installments = [{ valor: 33.33, data: new Date('2026-03-15'), parcelaNumero: 1, parcelaTotal: 3 }];
    vi.mocked(generateInstallments).mockReturnValue(installments as never);
    const createdPurchase = { id: 'p1', ...input };
    vi.mocked(purchaseRepository.createWithInstallments).mockResolvedValue(createdPurchase as never);

    const result = await purchaseService.create(input);

    expect(generateInstallments).toHaveBeenCalledWith({
      valorTotal: input.valorTotal,
      numeroParcelas: input.numeroParcelas,
      dataCompra: input.dataCompra,
    });
    expect(purchaseRepository.createWithInstallments).toHaveBeenCalledWith(input, installments);
    expect(result).toBe(createdPurchase);
  });

  it('get() throws AppError 404 when the purchase does not exist', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue(null);

    await expect(purchaseService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('remove() deletes the purchase when it exists', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue({ id: 'p1' } as never);

    await purchaseService.remove('p1');

    expect(purchaseRepository.remove).toHaveBeenCalledWith('p1');
  });

  it('remove() throws AppError 404 and does not call the repository when the purchase does not exist', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue(null);

    await expect(purchaseService.remove('missing')).rejects.toThrow(AppError);
    expect(purchaseRepository.remove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test -- purchase.service`
Expected: FAIL — `purchase.service.ts` doesn't exist yet.

- [ ] **Step 5: Implement `backend/src/services/purchase.service.ts`**

```ts
import { purchaseRepository } from '../repositories/purchase.repository';
import { AppError } from '../types/errors';
import type { CreatePurchaseInput } from '../validators/purchase.schema';
import { generateInstallments } from './purchase-installments';

export const purchaseService = {
  list() {
    return purchaseRepository.findAll();
  },

  async get(id: string) {
    const purchase = await purchaseRepository.findById(id);
    if (!purchase) throw new AppError('Compra não encontrada', 404);
    return purchase;
  },

  create(data: CreatePurchaseInput) {
    const installments = generateInstallments({
      valorTotal: data.valorTotal,
      numeroParcelas: data.numeroParcelas,
      dataCompra: data.dataCompra,
    });
    return purchaseRepository.createWithInstallments(data, installments);
  },

  async remove(id: string) {
    await this.get(id);
    return purchaseRepository.remove(id);
  },
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- purchase.service`
Expected: PASS (4 tests)

- [ ] **Step 7: Create `backend/src/controllers/purchase.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { purchaseService } from '../services/purchase.service';
import { createPurchaseSchema } from '../validators/purchase.schema';

type IdParams = { id: string };

export const purchaseController = {
  async list(_req: Request, res: Response) {
    const purchases = await purchaseService.list();
    res.json(purchases);
  },

  async get(req: Request<IdParams>, res: Response) {
    const purchase = await purchaseService.get(req.params.id);
    res.json(purchase);
  },

  async create(req: Request, res: Response) {
    const data = createPurchaseSchema.parse(req.body);
    const purchase = await purchaseService.create(data);
    res.status(201).json(purchase);
  },

  async remove(req: Request<IdParams>, res: Response) {
    await purchaseService.remove(req.params.id);
    res.status(204).send();
  },
};
```

- [ ] **Step 8: Create `backend/src/routes/purchase.routes.ts`**

```ts
import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';

export const purchaseRoutes = Router();

purchaseRoutes.get('/', purchaseController.list);
purchaseRoutes.get('/:id', purchaseController.get);
purchaseRoutes.post('/', purchaseController.create);
purchaseRoutes.delete('/:id', purchaseController.remove);
```

Note: no `PUT /:id` — per spec, editing a parceled purchase is out of scope for the MVP.

- [ ] **Step 9: Mount the routes in `backend/src/routes/index.ts`**

Add the import and `routes.use('/purchases', purchaseRoutes);` line.

- [ ] **Step 10: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add backend/src/validators/purchase.schema.ts backend/src/repositories/purchase.repository.ts backend/src/services/purchase.service.ts backend/src/services/purchase.service.test.ts backend/src/controllers/purchase.controller.ts backend/src/routes/purchase.routes.ts backend/src/routes/index.ts
git commit -m "feat: add Purchase CRUD with automatic installment generation"
```

---

### Task 5: Report calculation pure functions

**Files:**
- Create: `backend/src/services/report-calculations.ts`
- Test: `backend/src/services/report-calculations.test.ts`

**Interfaces:**
- Produces: `calcularSaldoMes`, `agruparGastoPorCategoria`, `agruparFaturaAtualPorCartao`, `construirFiltroExtrato`, `agruparFaturasFuturas`, `somarValores`, `calcularLimiteDisponivel`, and their input/output types (`ExtratoFiltro`, `GastoPorCategoria`, `FaturaPorCartao`, `FaturaFutura`). Consumed by Task 6 (`reports.service.ts`).

- [ ] **Step 1: Write the failing tests — `backend/src/services/report-calculations.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  construirFiltroExtrato,
  somarValores,
} from './report-calculations';

describe('calcularSaldoMes', () => {
  it('subtracts despesas from receitas', () => {
    const saldo = calcularSaldoMes([
      { tipo: 'RECEITA', valor: new Prisma.Decimal(1000) },
      { tipo: 'DESPESA', valor: new Prisma.Decimal(300) },
      { tipo: 'DESPESA', valor: new Prisma.Decimal(100) },
    ]);

    expect(saldo.toString()).toBe('600');
  });

  it('returns zero for an empty list', () => {
    expect(calcularSaldoMes([]).toString()).toBe('0');
  });
});

describe('agruparGastoPorCategoria', () => {
  it('sums valor per categoryId', () => {
    const grupos = agruparGastoPorCategoria([
      { valor: new Prisma.Decimal(50), categoryId: 'cat1', category: { nome: 'Mercado' } },
      { valor: new Prisma.Decimal(30), categoryId: 'cat1', category: { nome: 'Mercado' } },
      { valor: new Prisma.Decimal(20), categoryId: 'cat2', category: { nome: 'Transporte' } },
    ]);

    expect(grupos).toEqual([
      { categoriaId: 'cat1', nome: 'Mercado', total: new Prisma.Decimal(80) },
      { categoriaId: 'cat2', nome: 'Transporte', total: new Prisma.Decimal(20) },
    ]);
  });
});

describe('agruparFaturaAtualPorCartao', () => {
  it('sums valor per accountId', () => {
    const grupos = agruparFaturaAtualPorCartao([
      { valor: new Prisma.Decimal(100), accountId: 'acc1', account: { nome: 'Nubank' } },
      { valor: new Prisma.Decimal(50), accountId: 'acc1', account: { nome: 'Nubank' } },
    ]);

    expect(grupos).toEqual([{ accountId: 'acc1', nome: 'Nubank', total: new Prisma.Decimal(150) }]);
  });
});

describe('construirFiltroExtrato', () => {
  it('builds a date range for the given month', () => {
    const where = construirFiltroExtrato({ mes: '2026-03' });

    expect((where.data as { gte: Date }).gte.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect((where.data as { lt: Date }).lt.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(where).not.toHaveProperty('categoryId');
    expect(where).not.toHaveProperty('accountId');
  });

  it('includes categoriaId and accountId filters when provided', () => {
    const where = construirFiltroExtrato({ mes: '2026-03', categoriaId: 'cat1', accountId: 'acc1' });

    expect(where.categoryId).toBe('cat1');
    expect(where.accountId).toBe('acc1');
  });
});

describe('agruparFaturasFuturas', () => {
  it('groups by year-month, sorted ascending', () => {
    const grupos = agruparFaturasFuturas([
      { valor: new Prisma.Decimal(100), data: new Date(Date.UTC(2026, 4, 10)) },
      { valor: new Prisma.Decimal(50), data: new Date(Date.UTC(2026, 3, 5)) },
      { valor: new Prisma.Decimal(25), data: new Date(Date.UTC(2026, 3, 20)) },
    ]);

    expect(grupos).toEqual([
      { mes: '2026-04', total: new Prisma.Decimal(75) },
      { mes: '2026-05', total: new Prisma.Decimal(100) },
    ]);
  });
});

describe('somarValores', () => {
  it('sums the valor field across all transactions', () => {
    const total = somarValores([{ valor: new Prisma.Decimal(10) }, { valor: new Prisma.Decimal(15) }]);
    expect(total.toString()).toBe('25');
  });
});

describe('calcularLimiteDisponivel', () => {
  it('subtracts current and future invoices from the limit', () => {
    const disponivel = calcularLimiteDisponivel({
      limite: new Prisma.Decimal(5000),
      faturaAtual: new Prisma.Decimal(800),
      faturasFuturas: [
        { mes: '2026-09', total: new Prisma.Decimal(700) },
        { mes: '2026-10', total: new Prisma.Decimal(500) },
      ],
    });

    expect(disponivel.toString()).toBe('3000');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- report-calculations`
Expected: FAIL — `report-calculations.ts` doesn't exist yet.

- [ ] **Step 3: Implement `backend/src/services/report-calculations.ts`**

```ts
import { Prisma } from '../generated/prisma/client';

export type TransactionForSaldo = { tipo: 'RECEITA' | 'DESPESA'; valor: Prisma.Decimal };

export function calcularSaldoMes(transactions: TransactionForSaldo[]): Prisma.Decimal {
  return transactions.reduce((saldo, t) => {
    return t.tipo === 'RECEITA' ? saldo.plus(t.valor) : saldo.minus(t.valor);
  }, new Prisma.Decimal(0));
}

export type TransactionComCategoria = {
  valor: Prisma.Decimal;
  categoryId: string;
  category: { nome: string };
};

export type GastoPorCategoria = { categoriaId: string; nome: string; total: Prisma.Decimal };

export function agruparGastoPorCategoria(transactions: TransactionComCategoria[]): GastoPorCategoria[] {
  const totals = new Map<string, GastoPorCategoria>();
  for (const t of transactions) {
    const existing = totals.get(t.categoryId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.categoryId, { categoriaId: t.categoryId, nome: t.category.nome, total: t.valor });
    }
  }
  return [...totals.values()];
}

export type TransactionComConta = {
  valor: Prisma.Decimal;
  accountId: string;
  account: { nome: string };
};

export type FaturaPorCartao = { accountId: string; nome: string; total: Prisma.Decimal };

export function agruparFaturaAtualPorCartao(transactions: TransactionComConta[]): FaturaPorCartao[] {
  const totals = new Map<string, FaturaPorCartao>();
  for (const t of transactions) {
    const existing = totals.get(t.accountId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.accountId, { accountId: t.accountId, nome: t.account.nome, total: t.valor });
    }
  }
  return [...totals.values()];
}

export type ExtratoFiltro = { mes: string; categoriaId?: string; accountId?: string };

export function construirFiltroExtrato(filtro: ExtratoFiltro): Prisma.TransactionWhereInput {
  const [ano, mes] = filtro.mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));

  return {
    data: { gte: inicio, lt: fim },
    ...(filtro.categoriaId ? { categoryId: filtro.categoriaId } : {}),
    ...(filtro.accountId ? { accountId: filtro.accountId } : {}),
  };
}

export type TransactionComData = { valor: Prisma.Decimal; data: Date };

export type FaturaFutura = { mes: string; total: Prisma.Decimal };

export function agruparFaturasFuturas(transactions: TransactionComData[]): FaturaFutura[] {
  const totals = new Map<string, Prisma.Decimal>();
  for (const t of transactions) {
    const chave = `${t.data.getUTCFullYear()}-${String(t.data.getUTCMonth() + 1).padStart(2, '0')}`;
    totals.set(chave, (totals.get(chave) ?? new Prisma.Decimal(0)).plus(t.valor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total }));
}

export function somarValores(transactions: { valor: Prisma.Decimal }[]): Prisma.Decimal {
  return transactions.reduce((soma, t) => soma.plus(t.valor), new Prisma.Decimal(0));
}

export function calcularLimiteDisponivel(input: {
  limite: Prisma.Decimal;
  faturaAtual: Prisma.Decimal;
  faturasFuturas: FaturaFutura[];
}): Prisma.Decimal {
  const totalComprometido = input.faturasFuturas.reduce(
    (soma, f) => soma.plus(f.total),
    input.faturaAtual,
  );
  return input.limite.minus(totalComprometido);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- report-calculations`
Expected: PASS (9 tests)

- [ ] **Step 5: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/report-calculations.ts backend/src/services/report-calculations.test.ts
git commit -m "feat: add pure report calculation functions"
```

---

### Task 6: Reports repository + service (dashboard, extrato, fatura orchestration)

**Files:**
- Create: `backend/src/repositories/reports.repository.ts`
- Create: `backend/src/services/reports.service.ts`
- Test: `backend/src/services/reports.service.test.ts`

**Interfaces:**
- Consumes: everything from Task 5 (`report-calculations.ts`) and `accountRepository.findById` from Task 2.
- Produces: `reportsService.dashboard()`, `reportsService.extrato(filtro)`, `reportsService.fatura(accountId)` — consumed by Task 7's controller.

- [ ] **Step 1: Create `backend/src/repositories/reports.repository.ts`**

```ts
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

function inicioFimMesAtual() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  return { inicio, fim };
}

export const reportsRepository = {
  findTransactionsDoMesAtual() {
    const { inicio, fim } = inicioFimMesAtual();
    return prisma.transaction.findMany({
      where: { data: { gte: inicio, lt: fim } },
      include: { category: true, account: true },
    });
  },

  findTransactionsPorFiltro(where: Prisma.TransactionWhereInput) {
    return prisma.transaction.findMany({ where, orderBy: { data: 'desc' } });
  },

  findTransactionsDoCartaoApartirDe(accountId: string, apartirDe: Date) {
    return prisma.transaction.findMany({
      where: { accountId, data: { gte: apartirDe } },
    });
  },
};
```

- [ ] **Step 2: Write the failing service tests — `backend/src/services/reports.service.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountRepository } from '../repositories/account.repository';
import { reportsRepository } from '../repositories/reports.repository';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../types/errors';
import { reportsService } from './reports.service';

vi.mock('../repositories/reports.repository', () => ({
  reportsRepository: {
    findTransactionsDoMesAtual: vi.fn(),
    findTransactionsPorFiltro: vi.fn(),
    findTransactionsDoCartaoApartirDe: vi.fn(),
  },
}));

vi.mock('../repositories/account.repository', () => ({
  accountRepository: {
    findById: vi.fn(),
  },
}));

describe('reportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboard() aggregates saldo, gasto por categoria and fatura por cartão', async () => {
    vi.mocked(reportsRepository.findTransactionsDoMesAtual).mockResolvedValue([
      {
        tipo: 'RECEITA',
        valor: new Prisma.Decimal(1000),
        categoryId: 'cat-salario',
        category: { nome: 'Salário' },
        accountId: 'acc-corrente',
        account: { nome: 'Conta Corrente', tipo: 'CONTA_CORRENTE' },
      },
      {
        tipo: 'DESPESA',
        valor: new Prisma.Decimal(200),
        categoryId: 'cat-mercado',
        category: { nome: 'Mercado' },
        accountId: 'acc-cartao',
        account: { nome: 'Cartão Nubank', tipo: 'CARTAO_CREDITO' },
      },
    ] as never);

    const result = await reportsService.dashboard();

    expect(result.saldoMes.toString()).toBe('800');
    expect(result.gastoPorCategoria).toEqual([
      { categoriaId: 'cat-mercado', nome: 'Mercado', total: new Prisma.Decimal(200) },
    ]);
    expect(result.faturaAtualPorCartao).toEqual([
      { accountId: 'acc-cartao', nome: 'Cartão Nubank', total: new Prisma.Decimal(200) },
    ]);
  });

  it('extrato() builds the where clause and delegates to the repository', async () => {
    const transactions = [{ id: 't1' }];
    vi.mocked(reportsRepository.findTransactionsPorFiltro).mockResolvedValue(transactions as never);

    const result = await reportsService.extrato({ mes: '2026-03' });

    expect(result).toBe(transactions);
    expect(reportsRepository.findTransactionsPorFiltro).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Object) }),
    );
  });

  it('fatura() throws AppError 404 when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(reportsService.fatura('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('fatura() throws AppError 400 when the account is not a credit card', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue({
      id: 'acc1',
      tipo: 'CONTA_CORRENTE',
    } as never);

    await expect(reportsService.fatura('acc1')).rejects.toMatchObject({ status: 400 });
  });

  it('fatura() computes limiteDisponivel from current and future invoices', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue({
      id: 'acc1',
      tipo: 'CARTAO_CREDITO',
      limite: new Prisma.Decimal(5000),
    } as never);

    const hoje = new Date();
    const mesAtual = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 10));
    const proximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 10));

    vi.mocked(reportsRepository.findTransactionsDoCartaoApartirDe).mockResolvedValue([
      { valor: new Prisma.Decimal(800), data: mesAtual },
      { valor: new Prisma.Decimal(1200), data: proximoMes },
    ] as never);

    const result = await reportsService.fatura('acc1');

    expect(result.faturaAtual.toString()).toBe('800');
    expect(result.limiteDisponivel.toString()).toBe('3000');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- reports.service`
Expected: FAIL — `reports.service.ts` doesn't exist yet.

- [ ] **Step 4: Implement `backend/src/services/reports.service.ts`**

```ts
import { Prisma } from '../generated/prisma/client';
import { accountRepository } from '../repositories/account.repository';
import { reportsRepository } from '../repositories/reports.repository';
import { AppError } from '../types/errors';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  construirFiltroExtrato,
  somarValores,
  type ExtratoFiltro,
} from './report-calculations';

export const reportsService = {
  async dashboard() {
    const transactions = await reportsRepository.findTransactionsDoMesAtual();
    const despesas = transactions.filter((t) => t.tipo === 'DESPESA');
    const doCartao = transactions.filter((t) => t.account.tipo === 'CARTAO_CREDITO');

    return {
      saldoMes: calcularSaldoMes(transactions),
      gastoPorCategoria: agruparGastoPorCategoria(despesas),
      faturaAtualPorCartao: agruparFaturaAtualPorCartao(doCartao),
    };
  },

  extrato(filtro: ExtratoFiltro) {
    const where = construirFiltroExtrato(filtro);
    return reportsRepository.findTransactionsPorFiltro(where);
  },

  async fatura(accountId: string) {
    const account = await accountRepository.findById(accountId);
    if (!account) throw new AppError('Conta não encontrada', 404);
    if (account.tipo !== 'CARTAO_CREDITO') {
      throw new AppError('Conta não é um cartão de crédito', 400);
    }

    const hoje = new Date();
    const inicioMesAtual = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const inicioProximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));

    const transactions = await reportsRepository.findTransactionsDoCartaoApartirDe(
      accountId,
      inicioMesAtual,
    );
    const doMesAtual = transactions.filter((t) => t.data < inicioProximoMes);
    const futuras = transactions.filter((t) => t.data >= inicioProximoMes);

    const faturaAtual = somarValores(doMesAtual);
    const faturasFuturas = agruparFaturasFuturas(futuras);
    const limiteDisponivel = calcularLimiteDisponivel({
      limite: account.limite ?? new Prisma.Decimal(0),
      faturaAtual,
      faturasFuturas,
    });

    return { faturaAtual, faturasFuturas, limiteDisponivel };
  },
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- reports.service`
Expected: PASS (5 tests)

- [ ] **Step 6: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add backend/src/repositories/reports.repository.ts backend/src/services/reports.service.ts backend/src/services/reports.service.test.ts
git commit -m "feat: add reports service (dashboard, extrato, fatura)"
```

---

### Task 7: Reports controller + routes, final wiring, and full verification

**Files:**
- Create: `backend/src/controllers/reports.controller.ts`
- Create: `backend/src/routes/reports.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: `reportsService` from Task 6.

- [ ] **Step 1: Create `backend/src/controllers/reports.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';

type AccountIdParams = { id: string };

export const reportsController = {
  async dashboard(_req: Request, res: Response) {
    const dashboard = await reportsService.dashboard();
    res.json(dashboard);
  },

  async extrato(req: Request, res: Response) {
    const mes = String(req.query.mes ?? '');
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      res.status(400).json({ error: 'Parâmetro mes é obrigatório no formato YYYY-MM' });
      return;
    }
    const categoriaId = req.query.categoriaId ? String(req.query.categoriaId) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;

    const transactions = await reportsService.extrato({ mes, categoriaId, accountId });
    res.json(transactions);
  },

  async fatura(req: Request<AccountIdParams>, res: Response) {
    const fatura = await reportsService.fatura(req.params.id);
    res.json(fatura);
  },
};
```

- [ ] **Step 2: Create `backend/src/routes/reports.routes.ts`**

```ts
import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';

export const reportsRoutes = Router();

reportsRoutes.get('/dashboard', reportsController.dashboard);
reportsRoutes.get('/extrato', reportsController.extrato);
reportsRoutes.get('/accounts/:id/fatura', reportsController.fatura);
```

- [ ] **Step 3: Mount in `backend/src/routes/index.ts` (final version)**

```ts
import { Router } from 'express';
import { accountRoutes } from './account.routes';
import { categoryRoutes } from './category.routes';
import { purchaseRoutes } from './purchase.routes';
import { reportsRoutes } from './reports.routes';
import { transactionRoutes } from './transaction.routes';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

routes.use('/categories', categoryRoutes);
routes.use('/accounts', accountRoutes);
routes.use('/transactions', transactionRoutes);
routes.use('/purchases', purchaseRoutes);
routes.use(reportsRoutes);
```

- [ ] **Step 4: Type-check, lint, and run the full test suite**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: no type errors, no lint errors, all test files pass.

- [ ] **Step 5: Manual smoke test against a running instance**

Run: `docker compose up --build` (from `backend/`), then in another terminal:

```bash
# create an account (cartão de crédito)
curl -s -X POST localhost:3000/accounts -H 'Content-Type: application/json' \
  -d '{"nome":"Nubank","tipo":"CARTAO_CREDITO","limite":5000,"diaFechamento":10,"diaVencimento":17}'

# create a category
curl -s -X POST localhost:3000/categories -H 'Content-Type: application/json' \
  -d '{"nome":"Mercado","tipo":"DESPESA"}'

# create a parceled purchase (use the ids returned above)
curl -s -X POST localhost:3000/purchases -H 'Content-Type: application/json' \
  -d '{"accountId":"<accountId>","categoryId":"<categoryId>","valorTotal":300,"descricao":"Notebook","dataCompra":"2026-08-01","numeroParcelas":3}'

# check dashboard, extrato and fatura
curl -s localhost:3000/dashboard
curl -s 'localhost:3000/extrato?mes=2026-08'
curl -s localhost:3000/accounts/<accountId>/fatura
```

Expected: `/purchases` returns 201 with the purchase; `GET /transactions` shows 3 generated rows (`parcelaTotal: 3`) summing to 300; `/dashboard`, `/extrato`, and `/accounts/:id/fatura` return payloads matching the shapes in the spec (`docs/superpowers/specs/2026-08-08-backend-mvp-design.md`, section 3).

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/reports.controller.ts backend/src/routes/reports.routes.ts backend/src/routes/index.ts
git commit -m "feat: add dashboard, extrato and fatura endpoints"
```
