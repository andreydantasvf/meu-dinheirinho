# Meu Dinheirinho — Web

Vite + React + TypeScript, PWA instalável no iPhone via Safari ("Adicionar à Tela de Início"). Ver [`../docs/web-architecture.md`](../docs/web-architecture.md) para as decisões técnicas.

## Requisitos

- Docker (OrbStack/Docker Desktop) rodando
- Node 24.x + pnpm (só necessário para rodar fora do container)
- O backend (`../backend/`) rodando, **exceto no modo demo** (abaixo)

## Rodando em desenvolvimento

Siga o quick start do [README da raiz](../README.md#rodando-localmente): o `docker-compose.yml` fica na raiz do repo e sobe backend e web juntos. O web fica em `localhost:5173`, com hot reload via bind mount.

## Modo demo (sem backend)

```bash
pnpm install
pnpm dev:demo     # dev server da demo
pnpm build:demo   # build da demo (publicado num projeto separado da Vercel)
```

O app roda inteiro no navegador, com uma API falsa em `src/demo/` e dados fictícios no `localStorage`. Ver [`../docs/web-architecture.md#modo-demo`](../docs/web-architecture.md#modo-demo).

## Comandos úteis

```bash
pnpm build                  # build de produção (dist/, inclui o service worker)
pnpm preview                # servir o build localmente
pnpm lint                   # eslint
pnpm format                 # prettier --write
docker compose logs -f web  # logs do dev server (rodar a partir da raiz do repo)
```

## Observações

- `VITE_API_URL` (em `.env`) precisa ser o IP da sua máquina na rede local, não `localhost`, ao testar num iPhone físico: no aparelho, `localhost` é o próprio celular.
- Autenticação: senha → token (`x-api-token`) e desbloqueio por Face ID/Touch ID via WebAuthn, que só funciona em contexto seguro (`localhost` ou o domínio real com HTTPS). Ver a seção Auth de [`../docs/api.md`](../docs/api.md).
- Notificações push dos lembretes só funcionam num build (`pnpm build && pnpm preview`) ou no app publicado, não no `pnpm dev`. Ver [`../docs/web-architecture.md#notificações-push-lembretes`](../docs/web-architecture.md#notificações-push-lembretes).
