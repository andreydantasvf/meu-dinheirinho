# Arquitetura e decisões técnicas

Este documento registra como o backend e o mobile foram montados no setup inicial (agosto/2026), as decisões tomadas e por quê — principalmente o que não é óbvio só de ler o código. Ver [`mvp-spec.md`](./mvp-spec.md) para o escopo de produto e [`api.md`](./api.md) para o contrato de endpoints (rotas, request/response, formato de erros) que o mobile consome.

## Visão geral do repositório

Monorepo com duas pastas **totalmente independentes** (sem workspaces pnpm/npm compartilhado — cada uma tem seu próprio lockfile):

- `backend/` — API Express + TypeScript + Prisma + PostgreSQL, dockerizada.
- `mobile/` — App React Native + Expo.

Essa independência foi uma escolha deliberada: não há código compartilhado hoje (tipos/DTOs), então workspaces adicionariam complexidade sem benefício.

## Backend

### Camadas

`routes` → `controllers` → `services` → `repositories`. Regra importante: **só o repository importa o Prisma Client** (`src/lib/prisma.ts`). Services não sabem que o Prisma existe — chamam o repository e aplicam regra de negócio (ex. lançar `AppError` 404 se o recurso não existe).

A fatia vertical de `Category` (`src/{routes,controllers,services,repositories,validators}/category.*`) é o template de referência para implementar Account, Purchase e Transaction — todas as quatro (mais a fatia de agregação `reports.*`) já estão implementadas. Ver [`api.md`](./api.md) para o contrato completo de rotas/payloads.

### Prisma 7 — pontos não óbvios

- **Driver adapter é obrigatório**: `new PrismaClient()` sem adapter lança erro em runtime na v7. Usamos `@prisma/adapter-pg` (`src/lib/prisma.ts`).
- **Import do client gerado**: `generator client { provider = "prisma-client" }` (não `prisma-client-js`) gera código em `src/generated/prisma/` **sem** um `index.ts` — o import correto é de `../generated/prisma/client`, não do diretório.
- **`prisma.config.ts`** na raiz do backend substitui o antigo bloco `"prisma"` no `package.json` — `migrate`/`studio` dependem dele para achar o schema e o `DATABASE_URL`.
- Campos monetários usam `Decimal @db.Decimal(12, 2)` (não `Int`/`Float`) para evitar erro de arredondamento — no código isso chega como `Decimal` do `decimal.js`, não `number`.

### TypeScript em CommonJS (não ESM)

Decisão deliberada para reduzir fricção de quem está começando com Node (sem exigir extensão `.js` em imports relativos, sem dual-package hazard). Revisar se algum dia fizer sentido migrar para ESM.

### Sem autenticação

API aberta no MVP — decisão consciente, documentada na spec do produto. Se a API for exposta publicamente antes de implementar auth, avaliar ao menos uma API key fixa.

### Testes (Vitest)

Testes ficam colocados junto do código-fonte como `*.test.ts` (ex. `account.schema.test.ts` ao lado de `account.schema.ts`), não em uma pasta `__tests__` separada. Cobertura é de unidade apenas: services (com o repository mockado) e funções puras (validators, `report-calculations.ts`) — não há testes de integração/HTTP batendo em rotas reais ou no banco. Rodar com `pnpm test` (`vitest run`) ou `pnpm test:watch`.

A fatia de `reports.*` (`repository`/`service`/`controller`/`routes` sob `dashboard`/`extrato`/`fatura`) não segue o template de `category.*` à risca — não existe um model `Report` no Prisma; é uma camada de agregação somente-leitura sobre `Transaction`/`Account`.

### Docker

- `docker-compose.yml` mora em `backend/` (não na raiz do repo) — reforça que o backend é uma unidade auto-contida, do jeito que o Coolify vai consumir no deploy.
- Um único `Dockerfile` multi-stage (`dev` / `build` / `prod`). O dia a dia usa o estágio `dev` (`tsx watch`, hot reload via bind mount de `backend/:/app` + volume anônimo em `/app/node_modules` para não deixar o host sobrescrever o `node_modules` buildado pro Linux do container).
- **Porta do Postgres no host é `5433`, não `5432`** — a 5432 já estava ocupada por outro projeto nesta máquina. Internamente (container-to-container) continua `postgres:5432` normalmente.
- Imagem `postgres:18-alpine`: o Postgres 18 mudou o layout de dados no container — o volume precisa montar em `/var/lib/postgresql` (não mais `/var/lib/postgresql/data`), senão o container recusa subir com dado pré-existente.
- `ENV DATABASE_URL=...` no `Dockerfile` (estágio `base`) existe só como placeholder para o `prisma generate` (rodado via `postinstall`) conseguir resolver a variável durante o build da imagem — em runtime o `docker-compose.yml` sobrescreve com o valor real via `environment:`.

## Mobile

### Expo SDK fixado em 54 (de propósito)

O `create-expo-app` resolve por padrão para o SDK mais novo (era 57 quando este projeto foi criado), mas o app **Expo Go da App Store/Play Store** só roda a versão que a Apple/Google já aprovaram — hoje, SDK 54. Setar uma versão mais nova exigiria conta paga de desenvolvedor Apple (`eas go` + TestFlight) ou build local via Xcode só para testar em um iPhone físico. Como o objetivo é simplicidade (testar via QR code + Expo Go grátis), o projeto foi recriado com `create-expo-app@latest mobile --template default@sdk-54`.

**Antes de atualizar o SDK no futuro** (`npx expo install expo@latest && npx expo install --fix`), confirmar que o Expo Go da loja já suporta a nova versão — senão o fluxo de QR code para de funcionar até migrar para um dev client próprio.

### pnpm + Metro exige `node-linker=hoisted`

O bundler do React Native (Metro) resolve módulos com Node resolution clássico, sem suportar bem o node_modules simbólico/isolado padrão do pnpm. Sem isso, pacotes transitivos como `react-native-css-interop` (dependência do NativeWind) não são encontrados em runtime, e o bundle quebra com `Unable to resolve module ... could not be found within the project`. O `.npmrc` do mobile define `node-linker=hoisted` — **não remover**.

### Estrutura de rotas (Expo Router)

`app/_layout.tsx` monta o `Stack` raiz + `QueryClientProvider`. `app/(tabs)/` agrupa as 4 telas de tab (Home, Extrato, Cartões, Categorias); os dois formulários (Nova transação, Nova compra parcelada) são rotas modais fora do grupo de tabs. Todas as telas são placeholders — a Home é a única com lógica real: uma query do TanStack Query batendo em `/health` do backend, provando a integração ponta a ponta.

### NativeWind

Configurado via `babel.config.js` (`jsxImportSource: 'nativewind'` + plugin `nativewind/babel`) + `metro.config.js` (`withNativeWind`) + `tailwind.config.js`. Classes Tailwind funcionam via prop `className` nos componentes RN. Depois de mexer em `babel.config.js`/`tailwind.config.js`, rodar `npx expo start -c` se os estilos não atualizarem (cache do Metro).

### Conectando com o backend

`EXPO_PUBLIC_API_URL` (prefixo obrigatório do Expo para expor a variável no bundle do cliente) precisa ser o **IP da rede local do Mac**, não `localhost` — em um dispositivo físico via Expo Go, `localhost` resolve para o próprio celular. Exceção: no simulador iOS, `localhost` funciona (compartilha a rede do Mac). Ver `mobile/README.md` para o passo a passo de teste no iPhone.

## O que ainda não existe

- Telas reais no mobile (todas são placeholders hoje, exceto o health-check da Home).
- Autenticação (fora de escopo do MVP, conforme `mvp-spec.md`).
