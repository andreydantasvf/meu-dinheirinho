# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Monorepo with two **fully independent** projects (no shared workspaces, separate lockfiles) plus a docs folder:

- `backend/` — Express + TypeScript + Prisma + PostgreSQL API.
- `web/` — Vite + React PWA, installable on iPhone via Safari "Add to Home Screen" (replaces an earlier React Native/Expo mobile app that was abandoned before publishing — see `docs/web-architecture.md` for why).
- `docs/` — product spec (`docs/mvp-spec.md`), technical architecture/decisions log (`docs/architecture.md`), the backend API reference (`docs/api.md`), and the web app's own spec (`docs/web-mvp-spec.md`) and architecture doc (`docs/web-architecture.md`). Read `docs/architecture.md` before making non-trivial backend changes — it documents several non-obvious setup decisions (Prisma 7 driver-adapter requirement, Docker port/volume quirks, etc.) that aren't visible from the code alone. Read `docs/web-architecture.md` before making non-trivial changes in `web/` — it covers the PWA/iOS install caveats and the auth flow. Read `docs/api.md` before writing any screen that calls the backend — it has every route, request/response shape, and the Decimal-as-string serialization gotcha (money fields arrive as e.g. `"100.5"`, not a fixed-2-decimal string or a JS number).

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

**Auth**: single-user, minimal by design (see `docs/api.md`'s Auth section for full request/response shapes). `POST /auth/login` (password) and the `/auth/webauthn/*` routes (Face ID/Touch ID) are the only public routes besides `/health`; every other route requires a valid `x-api-token` header, checked by `requireAuth` middleware (`src/middlewares/require-auth.ts`). No user table, no multi-user support — the password and token-signing secret live in env vars (`AUTH_PASSWORD`, `AUTH_TOKEN_SECRET`).

## Web (`web/`)

### Commands

```bash
cd web
docker compose up --build    # start the Vite dev server in Docker (day-to-day dev loop, hot reload via bind mount)
pnpm dev                     # ...or run the Vite dev server directly on the host, same effect
pnpm build                   # production build (output in dist/, includes the generated service worker)
pnpm preview                 # serve the production build locally
pnpm lint                    # eslint
pnpm format                  # prettier --write
pnpm exec tsc --noEmit       # type-check
```

No test framework is configured yet.

### Architecture

Vite + React + TypeScript, installable as a PWA via Safari's "Add to Home Screen" on iOS — this replaces an earlier React Native/Expo mobile app that was abandoned before publishing to the App Store (see `docs/web-architecture.md` for the full rationale and iOS-specific caveats).

`react-router-dom` routing: a `TabsLayout` wraps the four tab screens (Home, Extrato, Cartões, Categorias) with a bottom tab bar; `NovaTransacao` and `NovaCompraParcelada` are modal-style routes rendered outside the tab layout; `Login` is the only unguarded route (guarded by `RequireAuth`, `src/components/RequireAuth.tsx`). All screens are placeholders except Home, which does a real TanStack Query call to the backend's `/categories` endpoint (`lib/api.ts`, `lib/query-client.ts`) — a protected route was chosen deliberately over `/health` (which is public) so this screen proves the `x-api-token` round-trip, not just that the API is reachable.

**Auth flow**: `Login` posts a password to `/auth/login` and stores the returned token (`lib/auth.ts`, `localStorage`). Every subsequent request from `lib/api.ts` sends that token as the `x-api-token` header; a `401` response clears the token and hard-redirects to `/login`. After the first successful login, the app offers to register a WebAuthn platform authenticator (Face ID/Touch ID) via `lib/webauthn.ts` — reopening the app afterward can re-authenticate through that instead of retyping the password. WebAuthn requires a secure context: it works over `localhost` for local dev, but in production needs the real deployed domain over HTTPS (the `rpID` must match the served origin's hostname) — see `docs/web-architecture.md`.

**PWA config** lives in `vite.config.ts` (`vite-plugin-pwa`, `generateSW` strategy) plus iOS-specific meta tags in `index.html` (`apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover` for safe-area/notch handling). Web Push notifications are intentionally **not** implemented — documented as future work in `docs/web-architecture.md` since it needs new backend infra (VAPID keys, a subscription table, a push-triggering job) that doesn't exist yet.

`VITE_API_URL` (in `.env`) must be the Mac's LAN IP, not `localhost`, when testing on a physical iPhone over the local network — `localhost` on-device resolves to the phone itself. `vite.config.ts` sets `server.host: true` so the dev server binds `0.0.0.0` (not just `localhost`) — required both for that LAN/iPhone case and for reaching the Vite dev server running inside Docker from the host.

`web/docker-compose.yml` is separate from `backend/`'s — each project's compose file is self-contained on purpose (mirrors how Coolify deploys them as independent units, see `docs/architecture.md`). Running both means `docker compose up --build` in each folder; the web dev server is exposed at `localhost:5173`.
