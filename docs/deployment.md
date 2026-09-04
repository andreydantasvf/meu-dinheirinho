# Deployment (Coolify + Vercel + GitHub Actions)

## Overview

- **Backend** (`backend/`) deploys as a Docker container to a VPS managed by **Coolify**, built from `backend/Dockerfile`'s `prod` target.
- **Frontend** (`web/`) deploys to **Vercel** via Vercel's native GitHub integration — no custom CI step needed for it.
- **GitHub Actions** is the glue: it lints/typechecks/tests both projects on every PR, and on every push to `main` it re-runs those checks and then calls a **Coolify deploy webhook** to redeploy the backend. Coolify's own auto-deploy-on-push must be turned **off** so the webhook (gated on CI passing) is the only thing that triggers a backend deploy.

> ⚠️ The Coolify/Vercel setup below is first-time and previously unverified — nobody has run a real Coolify deploy of this app before. Treat every step as something to confirm against the actual Coolify/Vercel UI (which may differ slightly from what's described), not as a known-good recipe to blindly copy. The Post-Deploy Verification checklist at the end exists specifically to catch anything that doesn't work as expected on the first real run.
>
> The `prod` Docker image itself (build → migrate → serve, described below) has been verified locally: `docker compose --profile prod build api-prod` builds cleanly, and running the resulting image applies the pending migration via `prisma migrate deploy` and then serves `/health` successfully. That part of the pipeline works; the Coolify/Vercel wiring around it is what's untested.

## Backend changes that make this work

Two small changes already made to `backend/` so the `prod` Docker image actually migrates and serves correctly — no further action needed, documented here so it's clear why they exist:

- `backend/Dockerfile`'s `prod` stage `CMD` now runs `pnpm prisma:deploy && node dist/server.js` instead of just `node dist/server.js` — otherwise schema migrations would never reach production automatically. `prisma migrate deploy` is idempotent (a no-op if there's nothing pending), so this is safe on every container start, not just the first one.
- `prisma` moved from `devDependencies` to `dependencies` in `backend/package.json`. The `prod` stage installs with `pnpm install --prod`, which skips `devDependencies` — with `prisma` there, both the build-time `postinstall: prisma generate` step and the new runtime `prisma:deploy` step would fail with `prisma: not found`. Verified locally: `docker compose --profile prod build api-prod` now builds cleanly, and running the resulting image applies the pending migration and serves `GET /health` successfully.

## First-Time Setup

Work through these in order — later steps depend on decisions made earlier (in particular, the backend's WebAuthn env vars depend on the frontend's final domain, so don't fill those in until step 6).

1. **Decide domains** (or accept defaults). Pick a domain for the backend, e.g. `api.example.com`, and one for the frontend, e.g. `app.example.com` (or just use the default `*.vercel.app` domain Vercel assigns if you don't have a custom domain yet). Replace the placeholders below with your real values as you go.

2. **Confirm Coolify access** to the VPS that will host the backend (already set up per your infra — this is just making sure you can create a new resource in it).

3. **Create a new Coolify resource/application** for the backend:
   - Connect it to this GitHub repo (via Coolify's GitHub App/integration).
   - Build pack: Dockerfile.
   - Point Coolify at `backend/Dockerfile`, target stage `prod`.
   - If Coolify's compose integration supports the `docker-compose.yml` `profiles: ['prod']` setup at the repo root, you can point it there instead and select the `prod` profile — but since `web-prod` (the nginx-served frontend) is unused now that the frontend deploys to Vercel, the simpler path is pointing Coolify directly at `backend/Dockerfile`, bypassing the root compose file for this resource entirely.

4. **Turn off Coolify's auto-deploy-on-push** for this resource. Deploys should only happen via the GitHub Actions webhook (step 13) after CI passes — this is the opposite of Coolify's default behavior, so don't skip this.

5. **Configure a persistent volume/storage mount** in Coolify for the SQLite database: mount path `/app/data` (not `/app/prisma` — see warning below).

   > ⚠️ **Never mount the persistent volume at `/app/prisma`.** A named/persistent volume is only populated from the image the *first* time it's created — after that, the volume's content shadows anything the image later brings to that same path, including new `prisma/migrations` folders. Every push after the first deploy would then build an image with a new migration, but the running container still sees only the old migration set from the (now stale) volume, so `prisma migrate deploy` silently applies nothing. This bit us in production once already (September 2026) — mounting at `/app/data` instead, matching the `DATABASE_URL` in step 6, keeps `schema.prisma`/`migrations` always sourced fresh from the image on every deploy, since the volume only covers the db file's own directory. The Post-Deploy Verification checklist below includes an explicit check that both data *and new migrations* survive a redeploy — don't skip it.

6. **Enter backend environment variables in Coolify's UI** (not a committed `.env` file — `backend/.env` is gitignored, so Coolify must supply these directly):

   | Variable | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | `file:./data/dev.db` | Relative to the container's `/app` working dir; persisted via the volume from step 5. Must **not** point inside `prisma/` — see the warning in step 5. |
   | `AUTH_PASSWORD` | a new production-only password | Do not reuse your local dev password. |
   | `AUTH_TOKEN_SECRET` | output of `openssl rand -base64 32` | Signs the auth token (HMAC-SHA256). |
   | `AUTH_USER_NAME` | e.g. `Andrey` | Optional, cosmetic — powers the "Olá, {name}" greeting. |
   | `WEBAUTHN_RP_ID` | bare hostname of the **frontend** domain, e.g. `app.example.com` | See warning below. |
   | `WEBAUTHN_RP_NAME` | e.g. `Meu Dinheirinho` | Cosmetic, shown in the OS Face ID/Touch ID prompt. |
   | `WEBAUTHN_ORIGIN` | full HTTPS origin of the **frontend**, e.g. `https://app.example.com` | See warning below. |
   | `NODE_ENV` | `production` | |
   | `PORT` | `3000` (default, can omit) | |

   > ⚠️ **`WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` must match the frontend's Vercel domain, not the backend's own Coolify domain.** WebAuthn validates against the origin the browser is actually running in (the frontend), even though these env vars live on the backend (since that's where `@simplewebauthn/server` validates). Getting this backwards is the easiest mistake to make here, and it fails **silently** — Face ID/Touch ID just won't work, with no obvious error pointing at the cause.

7. **Set the backend's domain** in Coolify (`api.example.com` from step 1) and let Coolify provision HTTPS via Let's Encrypt.

8. **Configure Coolify's health check** to hit `GET /health` (public route, no auth required, returns `{"status":"ok"}`).

9. **Trigger one manual deploy from Coolify's UI** to bootstrap the resource — confirms the image builds and the container starts (including the `prisma:deploy` migration step baked into the Dockerfile's `CMD`) before any automation is wired up. Confirm `curl https://api.example.com/health` responds once this finishes.

10. **Create the Vercel project** for the frontend: import this GitHub repo, set the project's root directory to `web/`, and let Vercel auto-detect the Vite framework preset. Leave build/output settings at Vercel's defaults — `web/vite.config.ts` has no `base` override and the default `outDir: dist`, which is exactly what Vercel's Vite preset expects.

11. **Set the Vercel environment variable** `VITE_API_URL` to the backend's real HTTPS URL from step 7 (e.g. `https://api.example.com`). Set it for both the Production and Preview scopes if you want PR preview deployments to also talk to the real backend. This is a **build-time** variable — Vite inlines `import.meta.env.VITE_API_URL` into the static bundle when `vite build` runs, so it must be set before the first build, not injected at runtime.

12. **Set the Vercel domain** (custom `app.example.com` from step 1, or accept the default `*.vercel.app` one). If the final domain differs from what you assumed in step 6, go back now and correct `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` in Coolify.

13. **Generate a Coolify deploy webhook** for the backend resource (Coolify's Settings → Webhooks screen, or equivalent — copy the exact `curl` command Coolify shows you, since the precise auth mechanism — bearer token vs. a token baked into the URL — should be confirmed against your actual Coolify version rather than assumed).

14. **Add GitHub repository secrets** (repo Settings → Secrets and variables → Actions): `COOLIFY_WEBHOOK_URL` and `COOLIFY_WEBHOOK_TOKEN`, from step 13.

15. **Commit and push the two workflow files** already added at `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (see "How the pipeline works" below) to `main`.

16. **Add a branch protection rule on `main`** requiring the `ci.yml` workflow's `backend-ci` and `web-ci` jobs to pass before a PR can be merged — this is what makes the "quality gate before deploy" actually enforced, not just advisory.

17. **Merge a throwaway PR** to exercise the full pipeline end-to-end for the first time, then work through the Post-Deploy Verification checklist below.

## How the pipeline works

- **`.github/workflows/ci.yml`** runs on every pull request targeting `main`. Two independent jobs, `backend-ci` and `web-ci` (both always run, regardless of which project a given PR touches — kept simple rather than path-filtered, since CI is cheap for a small two-job pipeline). Each installs dependencies, lints, typechecks, and — for the backend — runs the vitest suite (the web project has no test framework configured, so `pnpm build` is its correctness check).
- **`.github/workflows/deploy.yml`** runs on every push to `main` (i.e. after a PR merges). It repeats the same `backend-ci`/`web-ci` checks, then a `deploy-backend` job (gated with `needs: [backend-ci, web-ci]`) calls the Coolify webhook via `curl`. Gating on both projects' checks — even though only the backend gets redeployed here — means a broken frontend build on `main` isn't silently ignored just because the backend's checks happened to pass.
- **Vercel has no job in either workflow.** Its native GitHub integration (installed during step 10 above) auto-deploys on every push to `main` and creates a preview deployment for every PR — this is Vercel's idiomatic flow, and reimplementing it via a Vercel CLI step in Actions would just be redundant.

## Post-Deploy Verification

Work through all of these after the first real deploy — this setup has never been run before, so don't assume any of them will pass without checking:

1. `curl https://api.example.com/health` → `{"status":"ok"}`.
2. Check the Coolify container logs for the `prisma:deploy` output on startup — confirm it reports migrations applied cleanly (or "No pending migrations") rather than silently failing while `node dist/server.js` still starts.
3. Log in with the password from the deployed frontend (`https://app.example.com`) — confirms `AUTH_PASSWORD`/`AUTH_TOKEN_SECRET` are correct and that cross-origin calls from Vercel to Coolify work (the backend's CORS is fully open, so no extra config is needed here).
4. Register a WebAuthn credential (Face ID/Touch ID) from the real deployed frontend, log out, and re-authenticate with it. This is the step most likely to fail if `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` were set to the wrong domain (step 6) or the domains changed after the fact (step 12).
5. Merge a throwaway PR into `main` and confirm: `ci.yml` ran on the PR, `deploy.yml` ran on the merge push, the Coolify webhook fired (visible in Coolify's deployment history), and the backend picked up the change.
6. **Volume persistence check**: create a test record via the app, then trigger a redeploy (via the webhook again, or Coolify's "Redeploy" button) with no schema-affecting change, and confirm the record still exists afterward. If it's gone, the volume at `/app/prisma` isn't actually persisting across redeploys — check that Coolify's resolved volume config matches the `api-data:/app/prisma` mapping from `docker-compose.yml`, and that a redeploy doesn't recreate the container from a fresh volume by default.

## Fixing an existing deploy with the volume mounted at `/app/prisma`

If Coolify was already set up with the persistent storage at `/app/prisma` (the mistake described in step 5's warning above) and new migrations have stopped reaching production, migrate to `/app/data` without losing data:

1. In Coolify, **add a second persistent storage entry** for the same resource: destination `/app/data`, backed by a new volume — leave the existing `/app/prisma` one in place for now.
2. **Redeploy** so the container starts with both volumes mounted (`/app/prisma` with the old data, `/app/data` empty).
3. Open Coolify's terminal for the running container (or SSH into the VPS and `docker exec` into it) and run:
   ```bash
   mkdir -p /app/data
   cp /app/prisma/dev.db /app/data/dev.db
   ```
4. Update the `DATABASE_URL` env var to `file:./data/dev.db` (step 6 above).
5. **Redeploy again.** Check the container logs for the `prisma:deploy` step — it should now report the previously-missing migration(s) applying cleanly, and `GET /health` should still work. Spot-check that existing data (accounts, transactions, categories) is still there.
6. Once confirmed, **remove the old `/app/prisma` storage entry** in Coolify so future deploys stop mounting (and shadowing) it.

## Known follow-up (not done here)

`docs/web-architecture.md`'s "Deploy em produção (planejado, ainda não executado)" section still describes the frontend deploying via Coolify/nginx on the same VPS as the backend — that plan is now superseded by the Vercel setup described in this document. Update that section to describe Vercel instead, next time that doc is touched.
