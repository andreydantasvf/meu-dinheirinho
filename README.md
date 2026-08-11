# Meu Dinheirinho

App pessoal de controle financeiro (entradas, saídas, cartão de crédito e compras parceladas).

## Estrutura

- [`backend/`](./backend) — API em Express + TypeScript + Prisma + SQLite.
- [`web/`](./web) — App Vite + React, PWA instalável no iPhone via Safari.
- [`docs/`](./docs) — spec do produto, arquitetura e decisões técnicas, e futuras specs de novas funcionalidades.

Cada pasta de projeto (`backend/`, `web/`) é independente, com seu próprio `package.json` e README com instruções específicas de setup.
