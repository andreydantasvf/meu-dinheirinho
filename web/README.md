# Meu Dinheirinho — Web

Vite + React + TypeScript, PWA instalável no iPhone via Safari ("Adicionar à Tela de Início"). Substitui um app mobile React Native/Expo abandonado antes de ser publicado — ver [`../docs/web-architecture.md`](../docs/web-architecture.md) para o porquê e todas as decisões técnicas.

## Requisitos

- Docker (OrbStack/Docker Desktop) rodando
- Node 24.x + pnpm (só necessário se quiser rodar fora do container, ex. para lint/type-check no editor)
- O backend (`../backend/`) rodando — ver o README de lá. Este app não funciona sozinho.

## Rodando em desenvolvimento

```bash
cp .env.example .env   # ajuste VITE_API_URL se necessário — ver Observações abaixo
docker compose up --build
```

Isso sobe o dev server do Vite dentro de um container, com hot reload via bind mount. Exposto em `localhost:5173`.

Alternativa sem Docker: `pnpm install && pnpm dev`, mesmo efeito.

## Estado atual

Só `Login` e `Home` têm lógica real (login por senha/Face ID e uma chamada autenticada a `GET /categories`, que prova a integração com o backend). As outras 5 telas do MVP (`Extrato`, `Cartões`, `Categorias`, `Nova transação`, `Nova compra parcelada`) são placeholders — só o título, sem forms nem dados. Ver o checklist em [`../docs/web-mvp-spec.md`](../docs/web-mvp-spec.md#critério-de-pronto-para-esta-fase) e a seção "O que ainda não existe" em [`../docs/web-architecture.md`](../docs/web-architecture.md) para o que falta implementar.

## Comandos úteis

```bash
pnpm build                # build de produção (dist/, inclui o service worker gerado)
pnpm preview               # servir o build de produção localmente
pnpm lint                 # eslint
pnpm format                # prettier --write
pnpm exec tsc -b            # type-check
docker compose logs -f web  # acompanhar logs do dev server
```

## Observações

- `VITE_API_URL` (em `.env`) precisa ser o IP da rede local do Mac, não `localhost`, ao testar num iPhone físico — `localhost` no dispositivo resolve pro próprio celular, não pro Mac.
- Autenticação: senha → token (`x-api-token`) + desbloqueio por Face ID/Touch ID via WebAuthn. WebAuthn só funciona em contexto seguro — `localhost` está liberado por exceção do browser, mas em produção precisa do domínio real servido via HTTPS. Ver a seção Auth de [`../docs/api.md`](../docs/api.md) para o contrato dos endpoints e [`../docs/web-architecture.md`](../docs/web-architecture.md) para o fluxo completo.
- Notificações push **não estão implementadas** — documentadas como trabalho futuro em [`../docs/web-architecture.md`](../docs/web-architecture.md).
- `web/docker-compose.yml` é separado do `backend/docker-compose.yml` — cada projeto sobe com seu próprio `docker compose up --build` (mesma lógica de "unidade auto-contida" documentada em [`../docs/architecture.md`](../docs/architecture.md)).
