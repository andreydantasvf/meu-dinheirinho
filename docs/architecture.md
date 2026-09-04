# Arquitetura e decisões técnicas

Este documento registra como o backend foi montado no setup inicial (agosto/2026), as decisões tomadas e por quê — principalmente o que não é óbvio só de ler o código. Ver [`mvp-spec.md`](./mvp-spec.md) para o escopo de produto, [`api.md`](./api.md) para o contrato de endpoints (rotas, request/response, formato de erros) que o app web consome, e [`web-architecture.md`](./web-architecture.md) para as decisões técnicas do app web (que substituiu um app mobile React Native/Expo abandonado antes de ser publicado — ver esse documento para o porquê).

## Visão geral do repositório

Monorepo com duas pastas **totalmente independentes** (sem workspaces pnpm/npm compartilhado — cada uma tem seu próprio lockfile):

- `backend/` — API Express + TypeScript + Prisma + SQLite, dockerizada.
- `web/` — App Vite + React PWA.

Essa independência foi uma escolha deliberada: não há código compartilhado hoje (tipos/DTOs), então workspaces adicionariam complexidade sem benefício. O único ponto compartilhado é o Docker: um `docker-compose.yml` único na raiz do repo sobe os dois serviços juntos (ver seção Docker abaixo) — cada pasta continua sem saber da outra em termos de código/dependências.

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

- Um único `docker-compose.yml` na raiz do repo (não mais um por pasta) sobe `backend/` e `web/` juntos — decisão revertida em agosto/2026: originalmente cada projeto tinha seu próprio compose para espelhar unidades independentes no Coolify, mas isso só duplicava esforço no dia a dia local sem ganho real (o Coolify pode consumir o mesmo compose apontando pra cada serviço). Ver `docs/web-architecture.md#docker` para o lado do `web/`.
- `docker compose up --build` (sem flags) sobe só os serviços de dev — `api` (`localhost:3000`) e `web` (`localhost:5173`) — que usam o estágio `dev` de cada `Dockerfile` (hot reload via bind mount `./backend:/app` / `./web:/app` + volume anônimo em `/app/node_modules` para não deixar o host sobrescrever o `node_modules` buildado pro Linux do container).
- `docker compose --profile prod up --build` sobe `api-prod`/`web-prod` em vez disso — usam o estágio `prod` de cada `Dockerfile` (backend compilado rodando com `node`, bundle estático do web servido por `nginx` na porta 80). Ficam atrás de `profiles: ['prod']` justamente para nunca subir num `docker compose up` comum.
- Um único `Dockerfile` multi-stage por projeto (`dev` / `build` / `prod`). Cada `Dockerfile` continua vivendo na própria pasta (`backend/Dockerfile`, `web/Dockerfile`) — só o compose subiu pra raiz, com `context: ./backend` / `context: ./web` apontando de volta pra cada um.
- **Persistência do SQLite em produção**: um volume nomeado/persistente é montado em `/app/data` (não em `/app/prisma`) porque o estágio `prod` não tem bind mount — sem isso, `dev.db` seria perdido a cada rebuild/restart do container. Em dev, o arquivo já persiste normalmente dentro do bind mount `./backend:/app`, sem precisar de volume dedicado.
- ⚠️ **Nunca monte o volume persistente em `/app/prisma`** (ou em qualquer diretório pai dele). Um volume nomeado só é populado a partir da imagem na primeira vez que é criado — depois disso, o conteúdo do volume passa a esconder qualquer coisa nova que a imagem traga naquele caminho, incluindo `prisma/migrations`. Resultado: `migrations` novas commitadas depois do primeiro deploy nunca chegam ao container, e `prisma migrate deploy` não aplica nada, silenciosamente, mesmo com o build passando. Foi exatamente essa a causa de migrations "sumirem" em produção (setembro/2026) — por isso `DATABASE_URL` aponta para `/app/data/dev.db`, fora da árvore que o Dockerfile copia de `prisma/`, deixando `schema.prisma`/`migrations` sempre vir frescos da imagem a cada deploy.
- `ENV DATABASE_URL=...` no `Dockerfile` (estágio `base`) existe só como placeholder para o `prisma generate` (rodado via `postinstall`) conseguir resolver a variável durante o build da imagem — em runtime o `env_file: ./backend/.env` do `docker-compose.yml` sobrescreve com o valor real.
- ⚠️ **Deploy em produção** (Coolify) ainda não foi executado — o compose de raiz com o profile `prod` foi modelado com isso em mente, mas nunca testado contra um Coolify de verdade.

## Web

Ver [`web-architecture.md`](./web-architecture.md) para as decisões técnicas completas do app web (Vite/PWA, iOS install, WebAuthn, roteamento, etc.) — inclusive por que ele substituiu o app mobile React Native/Expo que existia antes.

## O que ainda não existe

- Telas reais no web (todas são placeholders hoje, exceto o health-check da Home — ver [`web-architecture.md`](./web-architecture.md)).
- Web Push notifications (documentado como trabalho futuro em [`web-architecture.md`](./web-architecture.md)).
