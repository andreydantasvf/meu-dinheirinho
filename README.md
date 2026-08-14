# Meu Dinheirinho

App pessoal de controle financeiro (entradas, saídas, cartão de crédito e compras parceladas).

## Estrutura

- [`backend/`](./backend) — API em Express + TypeScript + Prisma + SQLite.
- [`web/`](./web) — App Vite + React, PWA instalável no iPhone via Safari.
- [`docs/`](./docs) — spec do produto, arquitetura e decisões técnicas, e futuras specs de novas funcionalidades.

Cada pasta de projeto (`backend/`, `web/`) é independente, com seu próprio `package.json` e README com instruções específicas de setup. Os dois sobem juntos com um único `docker-compose.yml` na raiz do repo:

```bash
docker compose up --build                    # dev: backend em :3000, web em :5173
docker compose --profile prod up --build     # prod: backend em :3000, web (nginx) em :80
```

Ver [`CLAUDE.md`](./CLAUDE.md#docker-root-docker-composeyml) para detalhes.
