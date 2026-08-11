# Meu Dinheirinho — Backend

Express + TypeScript + Prisma + SQLite, com estrutura em camadas: `routes` → `controllers` → `services` → `repositories`.

## Requisitos

- Docker (OrbStack/Docker Desktop) rodando
- Node 24.x + pnpm (só necessário se quiser rodar fora do container, ex. para lint/type-check no editor)

## Rodando em desenvolvimento

```bash
cp .env.example .env   # já feito no setup inicial
docker compose up --build
```

Isso sobe um único container:
- `api`: Express rodando com `tsx watch` (hot reload). Código-fonte é bind-mounted, então qualquer alteração em `src/` reinicia o servidor automaticamente. Exposto em `localhost:3000`. O banco SQLite (`prisma/dev.db`) fica dentro desse mesmo bind mount, então persiste no host normalmente — não há container de banco separado nem volume nomeado.

Primeira vez rodando (ou após alterar `prisma/schema.prisma`):

```bash
docker compose exec api pnpm prisma migrate dev --name <nome_da_migration>
```

## Endpoints disponíveis

Ver [`../docs/api.md`](../docs/api.md) para o contrato completo. `GET /health` é pública; todo o resto exige o header `x-api-token` (ver a seção Auth desse documento).

## Comandos úteis

```bash
docker compose exec api pnpm prisma studio       # abrir Prisma Studio
docker compose logs -f api                        # acompanhar logs da API
```

## Observações

- Autenticação mínima single-user (senha + WebAuthn/Face ID) — ver [`../docs/api.md`](../docs/api.md).
- Prisma 7 exige um driver adapter — usamos `@prisma/adapter-better-sqlite3` (`src/lib/prisma.ts`), não dá para instanciar `PrismaClient()` puro.
- `better-sqlite3` compila nativamente; o `Dockerfile` instala `python3 make g++` no estágio base para isso funcionar no Alpine.
- Campos monetários usam `Decimal` do Prisma (não `number`), para evitar erro de arredondamento de float — sem `@db.Decimal(...)` (native type específico do Postgres, não suportado no SQLite).
