# Docs

Esta pasta guarda o contexto do produto e as decisões técnicas do projeto — o que não está óbvio só de ler o código — além de servir de lugar para novas specs conforme o projeto cresce.

- [`mvp-spec.md`](./mvp-spec.md) — spec original do produto: visão, escopo do MVP, modelagem de dados, telas, stack escolhida.
- [`architecture.md`](./architecture.md) — como o backend foi montado (camadas, Prisma/SQLite, autenticação, Docker), decisões tomadas e por quê, e armadilhas conhecidas.
- [`api.md`](./api.md) — contrato completo dos endpoints do backend (rotas, request/response, autenticação, formato de erros, a pegadinha do Decimal-como-string) para quem for escrever telas no `web/`.
- [`web-mvp-spec.md`](./web-mvp-spec.md) — spec de produto do app web (`web/`): por que ele substituiu o app mobile React Native/Expo original, escopo, autenticação, e o checklist do que já está pronto vs. pendente.
- [`web-architecture.md`](./web-architecture.md) — decisões técnicas do app web: Vite/PWA, instalação no iOS, roteamento, fluxo de autenticação (senha + WebAuthn/Face ID) ponta a ponta, Docker, notificações push dos lembretes, modo demo e o que falta.
- [`deployment.md`](./deployment.md) — passo a passo do deploy (backend no Coolify, web e demo na Vercel, pipeline do GitHub Actions).
- [`design/`](./design) — protótipo de design original do app. [`screenshots/`](./screenshots) — capturas da demo usadas no README.

Specs de novas funcionalidades (ex. `docs/spec-contas.md`, `docs/spec-parcelamento.md`) devem ser adicionadas aqui conforme forem escritas, seguindo o mesmo estilo do `mvp-spec.md`.
