# Arquitetura e decisões técnicas — Web

Decisões técnicas do app web (`web/`), que substituiu o app mobile React Native/Expo original (agosto/2026). Ver [`architecture.md`](./architecture.md) para as decisões do backend, [`web-mvp-spec.md`](./web-mvp-spec.md) para o escopo de produto, e [`api.md`](./api.md) para o contrato completo dos endpoints (inclusive a seção Auth).

## Por que web em vez de React Native/Expo

O `mobile/` (React Native + Expo) esbarrou na publicação na App Store antes de ter qualquer tela real implementada — só a Home tinha lógica de verdade (health-check). Sem funcionalidade a migrar, a troca para um PWA instalável via Safari eliminou o bloqueio de app-store distribution sem custo de retrabalho de produto. `mobile/` foi removido do monorepo nesta mesma sessão.

## Stack

Vite + React + TypeScript. `pnpm create vite web -- --template react-ts` como ponto de partida; ESLint + Prettier trocados pelo `oxlint` padrão do template para manter consistência com o `backend/` (mesmo estilo de `eslint.config.js`, mesmo `.prettierrc`).

## PWA (`vite-plugin-pwa`)

Estratégia `generateSW` (Workbox gerado automaticamente) em vez de `injectManifest` — não há nenhum handler customizado de service worker (push, sync em background) nesta fase, então o SW gerado automaticamente é suficiente. Revisar para `injectManifest` quando Web Push for implementado (precisa de um handler `push` customizado).

**Sem `runtimeCaching` para a API** — decisão deliberada, não omissão. O backend vive numa origem diferente (`VITE_API_URL`), então o precache do Workbox só cobre os assets estáticos do próprio app; respostas da API (saldo, transações) nunca são cacheadas pelo service worker e sempre batem na rede. Dado financeiro pessoal não deve arriscar ficar em cache stale.

### Instalação no iOS — pontos não óbvios

- `apple-mobile-web-app-capable` + `apple-touch-icon` (180×180) + `theme-color` no `index.html` são obrigatórios para o Safari oferecer "Adicionar à Tela de Início" com aparência de app nativo (sem barra de navegador). O `<link rel="icon">` do manifest sozinho **não** é suficiente no iOS.
- `viewport-fit=cover` no `<meta name="viewport">` habilita `env(safe-area-inset-*)` em CSS — usado na tab bar inferior (`pb-[env(safe-area-inset-bottom)]`) e no cabeçalho das rotas modais (`pt-[env(safe-area-inset-top)]`), para não ficar por baixo do notch/home indicator.
- Os ícones em `public/icon-{180,192,512}.png` são placeholders sólidos gerados por script (sem arte de marca ainda) — trocar por ícones reais é um follow-up de produto, não técnico.

## Estilização

Tailwind CSS v4 via `@tailwindcss/vite` — sem `tailwind.config.js` (configuração CSS-first da v4, só `@import 'tailwindcss';` em `src/index.css`). Escolhido para manter familiaridade com classes utilitárias, já que o `mobile/` abandonado usava NativeWind (Tailwind para RN).

## Roteamento (`react-router-dom` v7)

Estrutura em `src/App.tsx`:
- `/login` — única rota pública.
- Tudo mais fica atrás de `RequireAuth` (`src/components/RequireAuth.tsx`) — redireciona para `/login` se não houver token salvo. É um guard client-side (checa só a presença do token); a validação de verdade é sempre server-side via `x-api-token` em cada chamada de API.
- `TabsLayout` (`src/routes/TabsLayout.tsx`) envolve as 4 telas de aba (Home, Extrato, Cartões, Categorias) com uma tab bar inferior fixa (`components/BottomTabBar.tsx`).
- `transacoes/nova` e `compras/nova` são rotas irmãs de `TabsLayout` (não aninhadas nela), renderizadas como overlay de tela cheia via `components/ModalRoute.tsx` — espelha o padrão de "modal routes" que o `mobile/` usava no Expo Router.

## Estado do que é real vs. placeholder

Só `Home` (`src/routes/Home.tsx`) e `Login` (`src/routes/Login.tsx`) têm lógica de verdade nesta fase. `Extrato`, `Cartoes`, `Categorias`, `NovaTransacao`, `NovaCompraParcelada` são shells (só o título) — mesmo estado em que o `mobile/` abandonado estava antes de virar este app web.

`Home` chama `GET /categories` (rota **protegida**), não `/health` (que é pública) — escolha deliberada: provar que o token de auth está sendo enviado e aceito de ponta a ponta é mais valioso nesta fase do que só provar que a API está no ar.

## Autenticação — fluxo completo

Motivação: o backend passa a estar acessível pela internet pública (não só numa rede local de dev), e `architecture.md` já sinalizava "se a API for exposta publicamente, avaliar ao menos uma API key fixa" como a barra mínima. Implementado algo um pouco além disso — senha + token + WebAuthn — porque adicionar Face ID custa pouco a mais e evita redigitar senha num app de uso diário.

### Senha → token

- `AUTH_PASSWORD` (senha) e `AUTH_TOKEN_SECRET` (segredo de assinatura) vivem em variáveis de ambiente do backend, **em texto plano** — decisão deliberada, não descuido: não há tabela de usuário para proteger de um vazamento de banco, e a única superfície de vazamento é o próprio `.env`; se esse arquivo vazar, quem o tem já tem `DATABASE_URL` e acesso total aos dados, então hashear uma única senha não muda o modelo de ameaça.
- `POST /auth/login` compara a senha recebida com `AUTH_PASSWORD` via `crypto.timingSafeEqual` (evita timing attack) e, se bater, emite um token assinado — HMAC-SHA256 sobre `{ exp }` usando Node `crypto` nativo (sem dependência de `jsonwebtoken` para uma claim só). Válido por 90 dias.
- O middleware `requireAuth` (`backend/src/middlewares/require-auth.ts`) exige o header `x-api-token` válido em toda rota que não seja `/health` ou os endpoints públicos de `/auth` — ver [`api.md`](./api.md#auth) para a lista exata.
- `POST /auth/login` é rate-limited (`express-rate-limit`, 5 tentativas/15 min/IP) — é a única rota exposta a tentativa de força bruta sem qualquer outra barreira.

### Face ID/Touch ID (WebAuthn)

- Implementado como **WebAuthn verificado no servidor** (`@simplewebauthn/server` + `@simplewebauthn/browser`), não como um "gate local" decorativo. A diferença importa: se a biometria só liberasse um token já salvo em `localStorage`, qualquer um com acesso ao storage do navegador contornaria a biometria lendo o token direto — nesse desenho, em vez disso, a asserção biométrica É o passo que busca um token novo do backend, então um token estático roubado sozinho não basta.
- Fluxo de registro (`POST /auth/webauthn/register/*`) só é possível com um `x-api-token` válido — ou seja, só logo após um login por senha bem-sucedido, nunca "a frio". O app oferece isso automaticamente na primeira vez (tela de Login, `offerPasskey`).
- Fluxo de login (`POST /auth/webauthn/login/*`) é público — é assim que o app reautentica sem repetir a senha.
- O `challenge` de cada fluxo fica em memória no processo do backend (`webauthn.service.ts`), não num store externo — aceitável porque é single-user/single-instância; não sobrevive a um restart do processo nem escala para múltiplas instâncias, mas nenhum dos dois é uma restrição real neste projeto.
- **Requer contexto seguro**: funciona em `localhost` para dev (exceção padrão dos browsers), mas em produção precisa do domínio real servido via HTTPS — o `rpID` configurado (`WEBAUTHN_RP_ID`) precisa bater exatamente com o hostname servido. Isso empurra o requisito de deploy: não dá para testar Face ID contra um IP puro do Hostinger, precisa de domínio + certificado.
- No cliente, `hasRegisteredPasskey()` (`src/lib/auth.ts`) é uma heurística **local** (uma flag em `localStorage`) para decidir se mostra o botão "Entrar com Face ID" — não uma fonte de verdade. Se o `localStorage` for limpo, o credential ainda existe no backend, mas o botão some até o usuário logar de novo por senha e re-registrar. Limitação aceita para um MVP single-user.

## Docker

`web/Dockerfile` espelha o multi-stage do `backend/Dockerfile`: estágio `dev` (`pnpm dev`, hot reload via bind mount, o mesmo padrão `.:/app` + volume anônimo em `/app/node_modules` do backend) e um estágio `prod` que builda o bundle estático e serve via `nginx` com fallback de SPA (`nginx.conf`, `try_files ... /index.html` — necessário porque rotas do `react-router` como `/extrato` não existem como arquivo em disco).

`web/docker-compose.yml` é **separado** do `backend/docker-compose.yml`, de propósito — mesma lógica documentada em [`architecture.md`](./architecture.md#visão-geral-do-repositório): cada projeto é uma unidade auto-contida, do jeito que o Coolify consome no deploy. Não há um compose na raiz do repo unindo os dois; local, cada um sobe com seu próprio `docker compose up --build` (backend em `localhost:3000`, web em `localhost:5173`).

`vite.config.ts` define `server.host: true` para o dev server bindar em `0.0.0.0` — sem isso, o Vite dentro do container só escuta em `localhost` do próprio container, inacessível a partir do host.

## Deploy em produção (planejado, ainda não executado)

Estágio `prod` do `Dockerfile` (build estático + `nginx`) na mesma infraestrutura Coolify/Hostinger VPS já usada pelo backend — outra aplicação no mesmo Coolify, domínio próprio (necessário para HTTPS real e para o `rpID` do WebAuthn funcionar fora de `localhost`).

## Notificações push — fora de escopo desta fase (roadmap)

Web Push (Push API + Service Worker) documentado aqui como próximo passo, não implementado:
- Precisa de chaves VAPID geradas e guardadas no backend.
- Precisa de uma tabela `PushSubscription` (Prisma) para guardar a subscription de cada dispositivo que aceitar notificações.
- Precisa de algum gatilho — um job agendado (ex: avisar quando a fatura fecha) ou disparado por evento (ex: parcela vencendo hoje) — que hoje não existe no backend (nenhuma infra de cron/scheduler no projeto ainda).
- No `vite-plugin-pwa`, exigiria trocar `generateSW` por `injectManifest` para adicionar um handler `push` customizado ao service worker.
- Suporte do iOS: Web Push só funciona em Safari 16.4+ **com o PWA instalado na Tela de Início** (não funciona pelo Safari normal) — outra razão para a instalação via "Adicionar à Tela de Início" já ser parte do fluxo principal, não um extra.

## O que ainda não existe

- Lógica de negócio real em Extrato, Cartões, Categorias, Nova transação e Nova compra parcelada (todas placeholders — ver seção acima).
- Web Push notifications (ver seção acima).
- Deploy em produção (domínio + HTTPS + Coolify) — necessário antes de testar Face ID fora de `localhost`.
- Ícones de marca reais (os atuais são placeholders sólidos gerados por script).
