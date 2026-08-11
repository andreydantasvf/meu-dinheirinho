# Arquitetura e decisões técnicas

Este documento registra como o backend foi montado no setup inicial (agosto/2026), as decisões tomadas e por quê — principalmente o que não é óbvio só de ler o código. Ver [`mvp-spec.md`](./mvp-spec.md) para o escopo de produto, [`api.md`](./api.md) para o contrato de endpoints (rotas, request/response, formato de erros) que o app web consome, e [`web-architecture.md`](./web-architecture.md) para as decisões técnicas do app web (que substituiu um app mobile React Native/Expo abandonado antes de ser publicado — ver esse documento para o porquê).

## Visão geral do repositório

Monorepo com duas pastas **totalmente independentes** (sem workspaces pnpm/npm compartilhado — cada uma tem seu próprio lockfile):

- `backend/` — API Express + TypeScript + Prisma + SQLite, dockerizada.
- `web/` — App Vite + React PWA.

Essa independência foi uma escolha deliberada: não há código compartilhado hoje (tipos/DTOs), então workspaces adicionariam complexidade sem benefício.

## Backend

### Camadas

`routes` → `controllers` → `services` → `repositories`. Regra importante: **só o repository importa o Prisma Client** (`src/lib/prisma.ts`). Services não sabem que o Prisma existe — chamam o repository e aplicam regra de negócio (ex. lançar `AppError` 404 se o recurso não existe).

A fatia vertical de `Category` (`src/{routes,controllers,services,repositories,validators}/category.*`) é o template de referência para implementar Account, Purchase e Transaction — todas as quatro (mais a fatia de agregação `reports.*`) já estão implementadas. Ver [`api.md`](./api.md) para o contrato completo de rotas/payloads.

### Banco de dados: SQLite (não Postgres)

Trocado de PostgreSQL para SQLite pouco depois do setup inicial — projeto pessoal single-user, sem necessidade real de um servidor de banco separado. Um arquivo (`prisma/dev.db`) é suficiente e elimina um container inteiro (`postgres`) do dia a dia.

- **Driver adapter**: `@prisma/adapter-better-sqlite3` + `better-sqlite3` (`src/lib/prisma.ts`). Prisma 7 exige adapter mesmo para SQLite — `new PrismaClient()` puro continua não funcionando.
- **`better-sqlite3` compila nativamente** (bindings C++ via `node-gyp`) — não tem prebuild para o Alpine (musl) usado no `Dockerfile`, então o estágio `base` precisa de `apk add python3 make g++` antes do `pnpm install`, senão o build da imagem falha em "Could not find any Python installation".
- **`DATABASE_URL`** usa o formato `file:./prisma/dev.db` (caminho relativo ao diretório de onde o comando roda — `backend/`, tanto local quanto dentro do container). O código em `lib/prisma.ts` remove o prefixo `file:` antes de passar pro adapter, que espera um caminho de arquivo puro, não uma URL.
- **Sem `@db.Decimal(12, 2)`**: esse native type attribute é específico do conector Postgres — o SQLite rejeita a validação do schema com ele (`Native type Decimal is not supported for sqlite connector`). Removido dos campos monetários; o tipo Prisma `Decimal` sozinho já basta.
- ⚠️ **Verificado na prática, não só na documentação do Prisma**: mesmo o SQLite armazenando `DECIMAL`/`NUMERIC` com afinidade de tipo (que pode cair pra `REAL`/ponto flutuante binário internamente), o client do Prisma continua devolvendo um `Decimal` (`decimal.js`) que serializa como **string** em JSON — testado com valores classicamente problemáticos em float (`0.1`, `150.55`) e o round-trip bateu exato. O contrato "Decimal como string" documentado em [`api.md`](./api.md) **não mudou** com a troca de banco.
- **Import do client gerado**: `generator client { provider = "prisma-client" }` (não `prisma-client-js`) gera código em `src/generated/prisma/` **sem** um `index.ts` — o import correto é de `../generated/prisma/client`, não do diretório.
- **`prisma.config.ts`** na raiz do backend substitui o antigo bloco `"prisma"` no `package.json` — `migrate`/`studio` dependem dele para achar o schema e o `DATABASE_URL`.

### TypeScript em CommonJS (não ESM)

Decisão deliberada para reduzir fricção de quem está começando com Node (sem exigir extensão `.js` em imports relativos, sem dual-package hazard). Revisar se algum dia fizer sentido migrar para ESM.

### Autenticação

Single-user, mínima por design: `POST /auth/login` (senha) e as rotas `/auth/webauthn/*` (Face ID/Touch ID) são as únicas públicas além de `/health` — todo o resto exige o header `x-api-token`, validado pelo middleware `requireAuth`. Sem tabela de usuário, sem multiusuário — a senha e o segredo de assinatura do token vivem em variáveis de ambiente (`AUTH_PASSWORD`, `AUTH_TOKEN_SECRET`). Detalhes completos do fluxo (por que senha em texto plano no `.env` é aceitável aqui, estratégia do token, WebAuthn) em [`web-architecture.md`](./web-architecture.md); contrato dos endpoints em [`api.md`](./api.md).

### Testes (Vitest)

Testes ficam colocados junto do código-fonte como `*.test.ts` (ex. `account.schema.test.ts` ao lado de `account.schema.ts`), não em uma pasta `__tests__` separada. Cobertura é de unidade apenas: services (com o repository mockado) e funções puras (validators, `report-calculations.ts`) — não há testes de integração/HTTP batendo em rotas reais ou no banco. Rodar com `pnpm test` (`vitest run`) ou `pnpm test:watch`.

A fatia de `reports.*` (`repository`/`service`/`controller`/`routes` sob `dashboard`/`extrato`/`fatura`) não segue o template de `category.*` à risca — não existe um model `Report` no Prisma; é uma camada de agregação somente-leitura sobre `Transaction`/`Account`.

### Docker

- `docker-compose.yml` mora em `backend/` (não na raiz do repo) — reforça que o backend é uma unidade auto-contida, do jeito que o Coolify vai consumir no deploy.
- Um único `Dockerfile` multi-stage (`dev` / `build` / `prod`). O dia a dia usa o estágio `dev` (`tsx watch`, hot reload via bind mount de `backend/:/app` + volume anônimo em `/app/node_modules` para não deixar o host sobrescrever o `node_modules` buildado pro Linux do container).
- **Só um serviço no compose (`api`)** — desde a troca pra SQLite não existe mais container de banco separado. O arquivo `prisma/dev.db` fica dentro do bind mount `.:/app`, então persiste no host normalmente entre restarts do container, sem precisar de um volume nomeado dedicado (ao contrário do antigo `pgdata`).
- `ENV DATABASE_URL=...` no `Dockerfile` (estágio `base`) existe só como placeholder para o `prisma generate` (rodado via `postinstall`) conseguir resolver a variável durante o build da imagem — em runtime o `env_file: .env` do `docker-compose.yml` sobrescreve com o valor real.
- ⚠️ **Deploy em produção** (Coolify) ainda não foi executado — quando for, o estágio `prod` do `Dockerfile` não tem bind mount, então o arquivo SQLite precisa de um volume nomeado explícito para não ser perdido a cada deploy/restart do container. Não modelado neste repo ainda.

## Web

Ver [`web-architecture.md`](./web-architecture.md) para as decisões técnicas completas do app web (Vite/PWA, iOS install, WebAuthn, roteamento, etc.) — inclusive por que ele substituiu o app mobile React Native/Expo que existia antes.

## O que ainda não existe

- Telas reais no web (todas são placeholders hoje, exceto o health-check da Home — ver [`web-architecture.md`](./web-architecture.md)).
- Web Push notifications (documentado como trabalho futuro em [`web-architecture.md`](./web-architecture.md)).
