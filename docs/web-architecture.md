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

Todas as 6 telas do MVP (`Home`, `Extrato`, `Cartoes`, `Categorias`, `NovaTransacao`, `NovaCompraParcelada`) têm lógica de negócio real e completa contra o backend, além de `Login`.

`Home` chama `GET /categories` (rota **protegida**), não `/health` (que é pública) — escolha deliberada: provar que o token de auth está sendo enviado e aceito de ponta a ponta é mais valioso do que só provar que a API está no ar.

## Design system e camada de dados

Fundação técnica construída sobre o esqueleto acima (roteamento, auth, Tailwind, PWA já existentes): shadcn/ui, dark/light mode, TanStack Query, formulários. Pontos não óbvios:

**shadcn/ui**: instalado via `pnpm dlx shadcn@latest init` — a versão atual do CLI (v4.x) é uma reescrita relevante em relação aos tutoriais mais antigos: pede para escolher entre `base`/`radix`/`aria` como biblioteca headless (usamos `radix`), usa presets de estilo nomeados (`nova`, `vega`, ...) em vez de `new-york`/`default`, e **não existe mais um componente `form`** no registry — o equivalente é `field` (`src/components/ui/field.tsx`, primitivos de layout: `Field`, `FieldLabel`, `FieldError`...), usado manualmente junto com `react-hook-form` + `zod` (não há wrapper `Form`/`FormField` pronto). `components.json` fica na raiz de `web/`; tudo em `src/components/ui/*` é regenerado via CLI (`pnpm dlx shadcn@latest add <componente>`), não editado à mão.

**Paleta de gráficos**: o preset `nova` com base color `neutral` gera `--chart-1` a `--chart-5` em tons de cinza (`oklch(_ 0 0)`, croma zero) — inofensivo para botões/bordas, mas inutilizável para diferenciar séries num gráfico. Sobrescritos em `src/index.css` com uma paleta categórica de 5 cores distintas (teal/âmbar/azul/rosa/violeta), com uma variante mais clara no bloco `.dark` para contraste.

**Dark/light mode**: `ThemeProvider` próprio (`src/components/theme-provider.tsx`, ~40 linhas) em vez de `next-themes` — essa lib assume Next.js e não se aplica a um Vite SPA. Aplica a classe `dark` na tag `<html>`, persiste a escolha (`light`/`dark`/`system`) em `localStorage`. Toggle vive num `Sheet` de configurações, acessível pelo ícone no `AppHeader` (novo, dentro de `TabsLayout`).

**TanStack Query**: `src/lib/query-keys.ts` centraliza as chaves por entidade; `src/hooks/use-*.ts` (um arquivo por entidade) expõe os hooks de query e mutation sobre o `apiFetch` já existente — mutations invalidam as queries relacionadas no `onSuccess` (ex.: criar uma transação invalida `transactions`, `dashboard` e a `fatura` da conta envolvida).

**Formulários**: `react-hook-form` + `zod` (`zodResolver`). Dois gotchas encontrados na prática:

1. **Campo `Select` controlado (`useController`) num formulário de edição não pré-preenche.** Sintoma: o valor certo chega em `watch()`/`getValues()`, mas o `<Select>` continua mostrando o placeholder. Causa: quando a tela tem um gate de loading (`if (isLoadingX) return <Loading/>`) e o `useForm`/`reset()` só populam os campos DEPOIS que os dados assíncronos chegam, o primeiro mount real do `Select` (que só acontece quando o gate libera) corre em paralelo com esse `reset()` — o controller registra com o valor "vazio" antes do reset propagar. Corrigido evitando `reset()`/`values` numa `useEffect` para esse caso: mover o gate de loading para um componente **externo** ao que chama `useForm`, e computar `defaultValues` diretamente a partir do dado já carregado (ver `NovaTransacao.tsx`, componente `TransactionForm` separado de `NovaTransacao`). Formulários de edição que abrem via `Dialog` com o registro já disponível como prop (ex. `CategoryFormDialog`, `AccountFormDialog`) não têm esse problema — `reset()` numa `useEffect` funciona normalmente porque não há essa corrida com um carregamento assíncrono.
2. **`z.preprocess` no schema quebra a inferência de tipo do `zodResolver` só no build de produção.** `tsc -b` (usado por `pnpm build`) é mais estrito que `tsc --noEmit` e falha com um campo `unknown` quando o schema usa `z.preprocess` para tratar string vazia → `undefined` (caso dos campos numéricos opcionais de conta/cartão). Corrigido tratando a conversão no `register(nome, { setValueAs: ... })` em vez de no schema zod.

**Input de dinheiro**: `MoneyInput` (`src/components/money-input.tsx`) é um input mascarado baseado em centavos inteiros — digita da direita para a esquerda como um caixa eletrônico, formata via `Intl.NumberFormat('pt-BR', ...)`, converte para a string decimal que a API espera (`lib/money.ts`). Evita todo o parsing ambíguo de separador decimal vs. milhar.

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

O `web/` sobe através do `docker-compose.yml` único na raiz do repo (ver [`architecture.md`](./architecture.md#docker) para o detalhamento completo) — não há mais um compose por projeto. `docker compose up --build` (na raiz) sobe backend e web juntos: backend em `localhost:3000`, web em `localhost:5173`.

`vite.config.ts` define `server.host: true` para o dev server bindar em `0.0.0.0` — sem isso, o Vite dentro do container só escuta em `localhost` do próprio container, inacessível a partir do host.

**Gotcha: instalar uma dependência nova no host não basta para o container enxergá-la.** O volume anônimo `/app/node_modules` (declarado no `docker-compose.yml` da raiz para não deixar o bind mount `./web:/app` sobrescrever o `node_modules` instalado na imagem) sobrevive a um `docker compose up --build` sozinho — o container recém-criado reusa o volume antigo, com o `node_modules` de antes da instalação. Depois de rodar `pnpm add <pkg>` (ou `pnpm dlx shadcn@latest add ...`) no host, é preciso `docker compose up --build --force-recreate -V` (o `-V` remove os volumes anônimos) para o container instalar de fato a dependência nova — só `--build` não é suficiente e falha silenciosamente com um erro de import não resolvido no Vite.

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

- Testes automatizados no `web/` — decisão deliberada por ora (diferente do `backend/`, que usa Vitest); a arquitetura (funções puras em `lib/`, hooks isolados) foi montada para não bloquear adicionar testes depois, mas nenhum existe hoje.
- Web Push notifications (ver seção acima).
- Deploy em produção (domínio + HTTPS + Coolify) — necessário antes de testar Face ID fora de `localhost`.
- Ícones de marca reais (os atuais são placeholders sólidos gerados por script).
