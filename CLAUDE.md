# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Monorepo with two **fully independent** projects (no shared workspaces, separate lockfiles) plus a docs folder:

- `backend/` — Express + TypeScript + Prisma + PostgreSQL API.
- `mobile/` — React Native + Expo app.
- `docs/` — product spec (`docs/mvp-spec.md`) and technical architecture/decisions log (`docs/architecture.md`). Read `docs/architecture.md` before making non-trivial changes — it documents several non-obvious setup decisions (Prisma 7 driver-adapter requirement, pnpm+Metro hoisting requirement, why the mobile app is pinned to Expo SDK 54, Docker port/volume quirks, etc.) that aren't visible from the code alone.

Both projects use **pnpm**, not npm/yarn.

## Backend (`backend/`)

### Commands

```bash
cd backend
docker compose up --build       # start API + Postgres (day-to-day dev loop, hot reload via tsx watch)
docker compose exec api pnpm prisma migrate dev --name <name>   # run after editing prisma/schema.prisma
docker compose exec api pnpm prisma studio
docker compose exec postgres psql -U postgres -d meu_dinheirinho
docker compose logs -f api

pnpm lint                       # eslint
pnpm format                     # prettier --write
pnpm exec tsc --noEmit          # type-check without building
pnpm build && pnpm start        # production build (outside Docker)
pnpm test                       # vitest run
pnpm test:watch                 # vitest
```

Tests are colocated as `*.test.ts` next to the source file (e.g. `account.schema.test.ts` beside `account.schema.ts`), not in a separate `__tests__` folder. Coverage is unit-level only — services (repository mocked) and pure functions (validators, `report-calculations.ts`) — no integration/HTTP tests.

The API is exposed at `localhost:3000`; Postgres at `localhost:5433` (5432 was already taken by another local project — internal container-to-container traffic still uses `postgres:5432`).

### Architecture

Layered: `routes` → `controllers` → `services` → `repositories`. **Only repositories import the Prisma client** (`src/lib/prisma.ts`) — services call repositories and hold business rules (e.g. throwing `AppError` for a 404), they never touch Prisma directly. The `category.*` files across all four layers are the reference vertical slice to copy when implementing `Account`, `Purchase`, and `Transaction`.

Prisma 7 requires a driver adapter — `new PrismaClient()` without one throws at runtime; this project uses `@prisma/adapter-pg` (see `src/lib/prisma.ts`). The generated client has no `index.ts`; import from `../generated/prisma/client`. `prisma.config.ts` at the backend root (not `package.json`) configures the schema path and `DATABASE_URL` for `migrate`/`studio`.

Money fields are Prisma `Decimal` (`@db.Decimal(12, 2)`), not `number` — format/parse explicitly, don't treat them as JS numbers.

No authentication in the MVP — the API is intentionally open.

## Mobile (`mobile/`)

### Commands

```bash
cd mobile
pnpm start              # Metro bundler + QR code (scan with Expo Go on a physical device)
pnpm start --tunnel     # when the device can't reach the Metro server directly (VPN/corporate network)
pnpm ios                # iOS simulator (requires Xcode)
pnpm web                # browser
pnpm lint               # expo lint
pnpm format             # prettier --write
pnpm exec tsc --noEmit  # type-check
```

No test framework is configured yet.

### Architecture

Expo Router file-based routing: `app/_layout.tsx` mounts the root `Stack` + `QueryClientProvider`; `app/(tabs)/` groups the four tab screens (Home, Extrato, Cartões, Categorias); `nova-transacao.tsx` and `nova-compra-parcelada.tsx` are modal routes outside the tabs group. All screens are placeholders except Home, which does a real TanStack Query call to the backend's `/health` endpoint (`lib/api.ts`, `lib/query-client.ts`).

**The project is pinned to Expo SDK 54 on purpose** — the Expo Go app on the App Store/Play Store only supports the SDK version Apple/Google have approved (SDK 54 as of this writing), not whatever `create-expo-app` resolves to latest. Before running `npx expo install expo@latest`, check whether the store version of Expo Go already supports the target SDK — otherwise the QR-code dev workflow breaks until migrating to a custom dev client.

`.npmrc` sets `node-linker=hoisted` — required for Metro (React Native's bundler) to resolve transitive dependencies like `react-native-css-interop` (a NativeWind dependency) that pnpm's default isolated `node_modules` layout hides from Metro's Node-style resolution. Do not remove this setting.

`EXPO_PUBLIC_API_URL` (in `.env`) must be the Mac's LAN IP, not `localhost`, when testing on a physical device via Expo Go — `localhost` on-device resolves to the phone itself. The iOS simulator is the exception (`localhost` works there, since it shares the Mac's network).
