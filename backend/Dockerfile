# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
# Placeholder so `prisma generate` (run via postinstall) can resolve DATABASE_URL at build time.
# Overridden at runtime by docker-compose's `environment:` for the real connection.
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/meu_dinheirinho?schema=public"

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
