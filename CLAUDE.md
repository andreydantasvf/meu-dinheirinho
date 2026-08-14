# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Monorepo with two **fully independent** projects (no shared workspaces, separate lockfiles) plus a docs folder:

- `backend/` — Express + TypeScript + Prisma + SQLite API.
- `web/` — Vite + React PWA, installable on iPhone via Safari "Add to Home Screen" (replaces an earlier React Native/Expo mobile app that was abandoned before publishing — see `docs/web-architecture.md` for why).
- `docs/` — product spec (`docs/mvp-spec.md`), technical architecture/decisions log (`docs/architecture.md`), the backend API reference (`docs/api.md`), and the web app's own spec (`docs/web-mvp-spec.md`) and architecture doc (`docs/web-architecture.md`). Read `docs/architecture.md` before making non-trivial backend changes — it documents several non-obvious setup decisions (Prisma 7 driver-adapter requirement, Docker port/volume quirks, etc.) that aren't visible from the code alone. Read `docs/web-architecture.md` before making non-trivial changes in `web/` — it covers the PWA/iOS install caveats and the auth flow. Read `docs/api.md` before writing any screen that calls the backend — it has every route, request/response shape, and the Decimal-as-string serialization gotcha (money fields arrive as e.g. `"100.5"`, not a fixed-2-decimal string or a JS number).

Both projects use **pnpm**, not npm/yarn. Despite being independent projects (separate lockfiles, no shared workspace), both run through a single `docker-compose.yml` at the repo root — see "Docker (root `docker-compose.yml`)" below.

## Docker (root `docker-compose.yml`)

```bash
docker compose up --build                    # dev: api on :3000, web on :5173, hot reload via bind mounts
docker compose --profile prod up --build      # prod: api-prod on :3000, web-prod (nginx) on :80
```

One compose file for both dev and prod, at the repo root (not per-project). The `api`/`web` services (no `profiles` key) are the dev default and match the `dev` target of each project's `Dockerfile`; `api-prod`/`web-prod` are gated behind `profiles: ['prod']` so a plain `docker compose up` never starts them, and build the `prod` target instead (compiled backend served by `node`, static web bundle served by `nginx`). `api-prod` uses a named volume (`api-data`) for `prisma/dev.db` since the prod image has no bind mount to persist it across restarts.

## Backend (`backend/`)

### Commands

```bash
# from the repo root (day-to-day dev loop, hot reload via tsx watch — see "Docker" section above)
docker compose up --build
docker compose exec api pnpm prisma migrate dev --name <name>   # run after editing prisma/schema.prisma
docker compose exec api pnpm prisma studio
docker compose logs -f api

cd backend
pnpm lint                       # eslint
pnpm format                     # prettier --write
pnpm exec tsc --noEmit          # type-check without building
pnpm build && pnpm start        # production build (outside Docker)
pnpm test                       # vitest run
pnpm test:watch                 # vitest
```

Tests are colocated as `*.test.ts` next to the source file (e.g. `account.schema.test.ts` beside `account.schema.ts`), not in a separate `__tests__` folder. Coverage is unit-level only — services (repository mocked) and pure functions (validators, `report-calculations.ts`) — no integration/HTTP tests.

The API is exposed at `localhost:3000`. There's no separate database container — SQLite lives in a single file, `prisma/dev.db`, inside the bind-mounted `backend/` directory, so it persists on the host across container restarts without a named volume.

### Architecture

Layered: `routes` → `controllers` → `services` → `repositories`. **Only repositories import the Prisma client** (`src/lib/prisma.ts`) — services call repositories and hold business rules (e.g. throwing `AppError` for a 404), they never touch Prisma directly. The `category.*` files across all four layers are the reference vertical slice to copy when implementing `Account`, `Purchase`, and `Transaction`.

Prisma 7 requires a driver adapter — `new PrismaClient()` without one throws at runtime; this project uses `@prisma/adapter-better-sqlite3` (see `src/lib/prisma.ts`). `better-sqlite3` compiles native bindings via `node-gyp`, which is why the `Dockerfile` installs `python3 make g++` before `pnpm install` — the base `node:24-alpine` image doesn't have a C++ toolchain. The generated client has no `index.ts`; import from `../generated/prisma/client`. `prisma.config.ts` at the backend root (not `package.json`) configures the schema path and `DATABASE_URL` for `migrate`/`studio`.

Money fields are Prisma `Decimal`, not `number` — format/parse explicitly, don't treat them as JS numbers. No `@db.Decimal(...)` native type attribute (that's Postgres-only and fails schema validation on SQLite); plain `Decimal` is enough, and it still round-trips exact precision and serializes as a JSON string, verified directly against classic float traps (`0.1`, `150.55`) after the SQLite migration.

**Auth**: single-user, minimal by design (see `docs/api.md`'s Auth section for full request/response shapes). `POST /auth/login` (password) and the `/auth/webauthn/*` routes (Face ID/Touch ID) are the only public routes besides `/health`; every other route requires a valid `x-api-token` header, checked by `requireAuth` middleware (`src/middlewares/require-auth.ts`). No user table, no multi-user support — the password and token-signing secret live in env vars (`AUTH_PASSWORD`, `AUTH_TOKEN_SECRET`).

## Web (`web/`)

### Commands

```bash
# from the repo root (day-to-day dev loop, hot reload via bind mount — see "Docker" section above)
docker compose up --build

cd web
pnpm dev                     # ...or run the Vite dev server directly on the host, same effect
pnpm build                   # production build (output in dist/, includes the generated service worker)
pnpm preview                 # serve the production build locally
pnpm lint                    # eslint
pnpm format                  # prettier --write
pnpm exec tsc --noEmit       # type-check
```

No test framework is configured yet (deliberate for now, not an oversight — see `docs/web-architecture.md`).

After installing a new dependency on the host (`pnpm add`, `pnpm dlx shadcn@latest add ...`) while the Docker dev container is already running, `docker compose up --build` alone is **not** enough — the anonymous `node_modules` volume survives a plain rebuild. Use `docker compose up --build --force-recreate -V` (the `-V` drops anonymous volumes) or the container keeps the pre-install `node_modules` and the new import fails silently.

### Architecture

Vite + React + TypeScript, installable as a PWA via Safari's "Add to Home Screen" on iOS — this replaces an earlier React Native/Expo mobile app that was abandoned before publishing to the App Store (see `docs/web-architecture.md` for the full rationale and iOS-specific caveats).

`react-router-dom` routing: a `TabsLayout` wraps the four tab screens (Home, Extrato, Cartões, Categorias) with a bottom tab bar; `NovaTransacao` and `NovaCompraParcelada` are modal-style routes rendered outside the tab layout; `Login` is the only unguarded route (guarded by `RequireAuth`, `src/components/RequireAuth.tsx`). All 6 screens have real business logic against the backend, on top of `lib/api.ts` (raw fetch wrapper) and per-entity TanStack Query hooks in `src/hooks/` (query keys centralized in `lib/query-keys.ts`).

**Design system**: shadcn/ui (`components.json`, primitives in `src/components/ui/*`, regenerate via `pnpm dlx shadcn@latest add <name>` rather than hand-editing) with a custom `ThemeProvider` for dark/light/system mode (not `next-themes`, which is Next-only). Forms use `react-hook-form` + `zod`; shadcn's newer CLI has no `Form`/`FormField` wrapper, so forms are built manually from the `field` primitives. See `docs/web-architecture.md#design-system-e-camada-de-dados` for two non-obvious bugs hit while building this (a `Select`-prefill race condition in async-loaded edit forms, and a `z.preprocess` type-inference break that only surfaces in `tsc -b`/`pnpm build`, not `tsc --noEmit`) — worth reading before adding another form or another controlled `Select`.

**Auth flow**: `Login` posts a password to `/auth/login` and stores the returned token and display name (`lib/auth.ts`, `localStorage` — the name powers the "Olá, {name}" greeting on Home, sourced from the backend's optional `AUTH_USER_NAME` env var). Every subsequent request from `lib/api.ts` sends that token as the `x-api-token` header; a `401` response clears the token (and name) and hard-redirects to `/login`. After the first successful login, the app offers to register a WebAuthn platform authenticator (Face ID/Touch ID) via `lib/webauthn.ts` — reopening the app afterward can re-authenticate through that instead of retyping the password. WebAuthn requires a secure context: it works over `localhost` for local dev, but in production needs the real deployed domain over HTTPS (the `rpID` must match the served origin's hostname) — see `docs/web-architecture.md`.

**PWA config** lives in `vite.config.ts` (`vite-plugin-pwa`, `generateSW` strategy) plus iOS-specific meta tags in `index.html` (`apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover` for safe-area/notch handling). Web Push notifications are intentionally **not** implemented — documented as future work in `docs/web-architecture.md` since it needs new backend infra (VAPID keys, a subscription table, a push-triggering job) that doesn't exist yet.

`VITE_API_URL` (in `.env`) must be the Mac's LAN IP, not `localhost`, when testing on a physical iPhone over the local network — `localhost` on-device resolves to the phone itself. `vite.config.ts` sets `server.host: true` so the dev server binds `0.0.0.0` (not just `localhost`) — required both for that LAN/iPhone case and for reaching the Vite dev server running inside Docker from the host.

The web dev server runs as the `web` service in the root `docker-compose.yml` (see "Docker" section above), exposed at `localhost:5173`.
