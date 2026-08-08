# Meu Dinheirinho — Backend

Express + TypeScript + Prisma + PostgreSQL, com estrutura em camadas: `routes` → `controllers` → `services` → `repositories`.

## Requisitos

- Docker (OrbStack/Docker Desktop) rodando
- Node 24.x + pnpm (só necessário se quiser rodar fora do container, ex. para lint/type-check no editor)

## Rodando em desenvolvimento

```bash
cp .env.example .env   # já feito no setup inicial
docker compose up --build
```

Isso sobe dois containers:
- `postgres`: banco de dados, com o volume `pgdata` persistente. Exposto no host em `localhost:5433` (5432 já estava em uso por outro projeto nesta máquina).
- `api`: Express rodando com `tsx watch` (hot reload). Código-fonte é bind-mounted, então qualquer alteração em `src/` reinicia o servidor automaticamente. Exposto em `localhost:3000`.

Primeira vez rodando (ou após alterar `prisma/schema.prisma`):

```bash
docker compose exec api pnpm prisma migrate dev --name <nome_da_migration>
```

## Endpoints disponíveis

- `GET /health` — healthcheck
- `GET /categories`, `POST /categories`, `GET /categories/:id`, `PUT /categories/:id`, `DELETE /categories/:id` — CRUD de exemplo (fatia vertical completa: route → controller → service → repository). Use como referência para implementar Account, Purchase e Transaction.

## Comandos úteis

```bash
docker compose exec api pnpm prisma studio       # abrir Prisma Studio
docker compose exec postgres psql -U postgres -d meu_dinheirinho   # psql direto no container
docker compose logs -f api                        # acompanhar logs da API
```

## Observações

- **Sem autenticação** nesta fase do MVP — API aberta.
- `DATABASE_URL` no `.env` aponta para o host `postgres` (nome do serviço no compose). Se algum dia rodar a API fora do Docker contra o mesmo Postgres, troque para `localhost:5433` nessa variável.
- Prisma 7 exige um driver adapter — usamos `@prisma/adapter-pg` (`src/lib/prisma.ts`), não dá para instanciar `PrismaClient()` puro.
- Campos monetários usam `Decimal` do Prisma (não `number`), para evitar erro de arredondamento de float.
