# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
# better-sqlite3 has no prebuilt binary for this platform, so it compiles from source via
# node-gyp — needs Python + a C++ toolchain, not present in the base alpine image.
RUN apk add --no-cache python3 make g++
# Placeholder so `prisma generate` (run via postinstall) can resolve DATABASE_URL at build time.
# Overridden at runtime by the real .env value (see docker-compose.yml's env_file).
ENV DATABASE_URL="file:./prisma/dev.db"

# ---- dev: full deps, hot reload via tsx watch, source bind-mounted by compose ----
FROM base AS dev
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---- build: compiles TS + generates Prisma client for production ----
FROM base AS build
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- prod: minimal runtime image ----
FROM base AS prod
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
EXPOSE 3000
CMD ["node", "dist/server.js"]
