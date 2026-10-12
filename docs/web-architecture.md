# Arquitetura e decisões técnicas — Web

Decisões técnicas do app web (`web/`), que substituiu o app mobile React Native/Expo original (agosto/2026). Ver [`architecture.md`](./architecture.md) para as decisões do backend, [`web-mvp-spec.md`](./web-mvp-spec.md) para o escopo de produto, e [`api.md`](./api.md) para o contrato completo dos endpoints (inclusive a seção Auth).

## Por que web em vez de React Native/Expo

O `mobile/` (React Native + Expo) esbarrou na publicação na App Store antes de ter qualquer tela real implementada — só a Home tinha lógica de verdade (health-check). Sem funcionalidade a migrar, a troca para um PWA instalável via Safari eliminou o bloqueio de app-store distribution sem custo de retrabalho de produto. `mobile/` foi removido do monorepo nesta mesma sessão.

## Stack

Vite + React + TypeScript. `pnpm create vite web -- --template react-ts` como ponto de partida; ESLint + Prettier trocados pelo `oxlint` padrão do template para manter consistência com o `backend/` (mesmo estilo de `eslint.config.js`, mesmo `.prettierrc`).

## PWA (`vite-plugin-pwa`)

Estratégia `injectManifest` com SW próprio em `src/sw.ts` (antes era `generateSW`; trocado para os lembretes, que precisam de handlers `push`/`notificationclick`). O `sw.ts` replica exatamente o que o `generateSW` gerava — `skipWaiting()` + `clientsClaim()` (o `registerType: 'autoUpdate'` depende disso), `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()` e o fallback SPA (`NavigationRoute` → `index.html`). Ele tem seu próprio `tsconfig.sw.json` (lib `WebWorker`) e fica excluído do `tsconfig.app.json`, porque misturar as libs `DOM` e `WebWorker` num mesmo projeto TS gera conflito de tipos.

**Sem `runtimeCaching` para a API** — decisão deliberada, não omissão. O backend vive numa origem diferente (`VITE_API_URL`), então o precache do Workbox só cobre os assets estáticos do próprio app; respostas da API (saldo, transações) nunca são cacheadas pelo service worker e sempre batem na rede. Dado financeiro pessoal não deve arriscar ficar em cache stale. (Isso não significa que não há cache de leitura nenhum — ver "Uso offline (leitura)" abaixo, que resolve isso numa camada diferente, sem envolver o service worker.)

### Instalação no iOS — pontos não óbvios

- `apple-mobile-web-app-capable` + `apple-touch-icon` (180×180) + `theme-color` no `index.html` são obrigatórios para o Safari oferecer "Adicionar à Tela de Início" com aparência de app nativo (sem barra de navegador). O `<link rel="icon">` do manifest sozinho **não** é suficiente no iOS.
- `viewport-fit=cover` no `<meta name="viewport">` habilita `env(safe-area-inset-*)` em CSS — usado na tab bar inferior (`pb-[env(safe-area-inset-bottom)]`) e no cabeçalho das rotas modais (`pt-[env(safe-area-inset-top)]`), para não ficar por baixo do notch/home indicator.
- **Campo editável com fonte < 16px faz o Safari dar zoom ao focar** (e a tela fica ampliada depois do blur). O `Input` do shadcn já usa `text-base md:text-sm`; não sobrescrever com `text-sm`/`text-xs` puro em inputs — usar `text-base md:text-sm`. Não usamos `maximum-scale=1` no viewport porque isso também bloqueia o zoom de pinça (acessibilidade) em outros navegadores.
- **Não existe "puxar para atualizar" no PWA instalado** (standalone não tem a UI do Safari) e o `index.css` ainda desliga o overscroll da página (`overscroll-behavior-y: none`). O gesto é próprio: `src/components/pull-to-refresh.tsx`, montado no `TabsLayout` (só telas de aba; rotas modais ficam fora). Com a página no topo, arrastar para baixo e soltar refaz as queries ativas (`refetchQueries({ type: 'active' })`). Gestos horizontais (ex. carteira de cartões), página rolada, dialogs/selects abertos e offline (queries pausadas nunca terminariam) não disparam.
- Os ícones em `public/icon-{180,192,512}.png` são placeholders sólidos gerados por script (sem arte de marca ainda) — trocar por ícones reais é um follow-up de produto, não técnico.

## Estilização

Tailwind CSS v4 via `@tailwindcss/vite` — sem `tailwind.config.js` (configuração CSS-first da v4, só `@import 'tailwindcss';` em `src/index.css`). Escolhido para manter familiaridade com classes utilitárias, já que o `mobile/` abandonado usava NativeWind (Tailwind para RN).

## Roteamento (`react-router-dom` v7)

Estrutura em `src/App.tsx`:
- `/login` — única rota pública.
- Tudo mais fica atrás de `RequireAuth` (`src/components/RequireAuth.tsx`) — redireciona para `/login` se não houver token salvo. É um guard client-side (checa só a presença do token); a validação de verdade é sempre server-side via `x-api-token` em cada chamada de API.
- `TabsLayout` (`src/routes/TabsLayout.tsx`) envolve as 4 telas de aba (Home, Extrato, Cartões, Categorias) com uma tab bar inferior fixa (`components/BottomTabBar.tsx`).
- `lembretes` também fica dentro do `TabsLayout` (ganha header/sidebar), mas **não** é aba — a tab bar continua com 4 itens. Acesso pelo sino no `AppHeader` (mobile) e por um item na `desktop-sidebar`.
- `transacoes/nova` e `compras/nova` são rotas irmãs de `TabsLayout` (não aninhadas nela), renderizadas como overlay de tela cheia via `components/ModalRoute.tsx` — espelha o padrão de "modal routes" que o `mobile/` usava no Expo Router.

## Estado do que é real vs. placeholder

Todas as 6 telas do MVP (`Home`, `Extrato`, `Cartoes`, `Categorias`, `NovaTransacao`, `NovaCompraParcelada`) têm lógica de negócio real e completa contra o backend, além de `Login`.

`Home` chama `GET /categories` (rota **protegida**), não `/health` (que é pública) — escolha deliberada: provar que o token de auth está sendo enviado e aceito de ponta a ponta é mais valioso do que só provar que a API está no ar.

## Padrões de Componentes e Rotas

Para manter a organização do frontend (evitar duplicações silenciosas e arquivos enormes), seguimos regras estritas sobre como componentes devem ser declarados e organizados:

1. **Rotas não devem conter sub-componentes**: Nenhum componente auxiliar (ex: modais, formulários, botões específicos) deve ser declarado dentro de arquivos em `src/routes/*` ou mesmo nos componentes principais de `src/components/*` no formato de função no final do arquivo. Eles devem ser extraídos ou removidos.
2. **1 componente por arquivo (para lógicas e UIs complexas)**: Componentes com lógica de negócio ou interface complexa (como `TransactionForm`, `CardFace`, seletores visuais) ganham seu próprio arquivo isolado (`src/components/nome-do-componente.tsx`).
3. **Exceção 1 — Utilitários e Wrappers de Formulário**: Componentes muito pequenos que apenas conectam o `react-hook-form` a inputs comuns (`ControlledMoneyInput`, `ControlledDatePicker`, `ControlledSelect`) não precisam de dezenas de arquivos minúsculos de 10 linhas. Eles são agrupados e exportados num único arquivo `src/components/controlled-fields.tsx`.
4. **Exceção 2 — shadcn/ui**: Os arquivos gerados na pasta `src/components/ui/*` inerentemente exportam múltiplos pequenos pedaços estruturais de uma UI (ex: `Dialog`, `DialogTrigger`, `DialogContent`). Nunca alteramos esse padrão gerado.

## Design system e camada de dados

Fundação técnica construída sobre o esqueleto acima (roteamento, auth, Tailwind, PWA já existentes): shadcn/ui, dark/light mode, TanStack Query, formulários. Pontos não óbvios:

**shadcn/ui**: instalado via `pnpm dlx shadcn@latest init` — a versão atual do CLI (v4.x) é uma reescrita relevante em relação aos tutoriais mais antigos: pede para escolher entre `base`/`radix`/`aria` como biblioteca headless (usamos `radix`), usa presets de estilo nomeados (`nova`, `vega`, ...) em vez de `new-york`/`default`, e **não existe mais um componente `form`** no registry — o equivalente é `field` (`src/components/ui/field.tsx`, primitivos de layout: `Field`, `FieldLabel`, `FieldError`...), usado manualmente junto com `react-hook-form` + `zod` (não há wrapper `Form`/`FormField` pronto). `components.json` fica na raiz de `web/`; tudo em `src/components/ui/*` é regenerado via CLI (`pnpm dlx shadcn@latest add <componente>`), não editado à mão.

**Paleta de gráficos**: o preset `nova` com base color `neutral` gera `--chart-1` a `--chart-5` em tons de cinza (`oklch(_ 0 0)`, croma zero) — inofensivo para botões/bordas, mas inutilizável para diferenciar séries num gráfico. Sobrescritos em `src/index.css` com uma paleta categórica de 5 cores distintas (teal/âmbar/azul/rosa/violeta), com uma variante mais clara no bloco `.dark` para contraste.

**Dark/light mode**: `ThemeProvider` próprio (`src/components/theme-provider.tsx`) em vez de `next-themes` — essa lib assume Next.js e não se aplica a um Vite SPA. Aplica a classe `dark` na tag `<html>`, persiste a escolha (`light`/`dark`/`system`) em `localStorage`, e expõe um `resolvedTheme: 'light' | 'dark'` derivado (resolve `system` via `matchMedia`) para quem precisa saber a aparência efetiva sem duplicar a lógica de media query. Único controle de UI é o `ThemeQuickToggle` no `AppHeader` — um ícone sol/lua que alterna direto entre claro e escuro a partir de `resolvedTheme` (não há mais um Sheet de configurações com as 3 opções lado a lado); **consequência**: uma vez que o usuário toca no ícone, o tema vira uma escolha explícita e "sai" do modo `system` — não há mais como voltar a `system` pela UI, só limpando a chave `theme` do `localStorage`.

**TanStack Query**: `src/lib/query-keys.ts` centraliza as chaves por entidade; `src/hooks/use-*.ts` (um arquivo por entidade) expõe os hooks de query e mutation sobre o `apiFetch` já existente — mutations invalidam as queries relacionadas no `onSuccess` (ex.: criar uma transação invalida `transactions`, `dashboard` e a `fatura` da conta envolvida).

**Formulários**: `react-hook-form` + `zod` (`zodResolver`). Dois gotchas encontrados na prática:

1. **Campo `Select` controlado (`useController`) num formulário de edição não pré-preenche.** Sintoma: o valor certo chega em `watch()`/`getValues()`, mas o `<Select>` continua mostrando o placeholder. Causa: quando a tela tem um gate de loading (`if (isLoadingX) return <Loading/>`) e o `useForm`/`reset()` só populam os campos DEPOIS que os dados assíncronos chegam, o primeiro mount real do `Select` (que só acontece quando o gate libera) corre em paralelo com esse `reset()` — o controller registra com o valor "vazio" antes do reset propagar. Corrigido evitando `reset()`/`values` numa `useEffect` para esse caso: mover o gate de loading para um componente **externo** ao que chama `useForm`, e computar `defaultValues` diretamente a partir do dado já carregado (ver `NovaTransacao.tsx` e `NovaCompraParcelada.tsx`: o gate é o `EditRouteGate` (`src/components/edit-route-gate.tsx`), que só renderiza o formulário com o registro já carregado e cobre também os estados de erro/404 e offline-sem-cache — onde `isLoading` é `false` e o formulário abriria em branco). Esses formulários usam `values` + `resetOptions: { keepDirtyValues: true }` para absorver um refetch que chega depois do cache sem apagar o que o usuário já digitou. Formulários de edição que abrem via `Dialog` com o registro já disponível como prop (ex. `CategoryFormDialog`, `AccountFormDialog`) não têm esse problema — `reset()` numa `useEffect` funciona normalmente porque não há essa corrida com um carregamento assíncrono.
2. **`z.preprocess` no schema quebra a inferência de tipo do `zodResolver` só no build de produção.** `tsc -b` (usado por `pnpm build`) é mais estrito que `tsc --noEmit` e falha com um campo `unknown` quando o schema usa `z.preprocess` para tratar string vazia → `undefined` (caso dos campos numéricos opcionais de conta/cartão). Corrigido tratando a conversão no `register(nome, { setValueAs: ... })` em vez de no schema zod.

**Input de dinheiro**: `MoneyInput` (`src/components/money-input.tsx`) é um input mascarado baseado em centavos inteiros — digita da direita para a esquerda como um caixa eletrônico, formata via `Intl.NumberFormat('pt-BR', ...)`, converte para a string decimal que a API espera (`lib/money.ts`). Evita todo o parsing ambíguo de separador decimal vs. milhar.

**Carrossel "carteira" de cartões** (`src/components/card-wallet.tsx`): shadcn's `Carousel` (`src/components/ui/carousel.tsx`, gerado via `pnpm dlx shadcn@latest add carousel`, único uso de `embla-carousel-react` no projeto) por baixo de um efeito de pilha (Apple Wallet/Nubank) escrito à mão em cima da API do embla — não existe um plugin de "stack" pronto. Cada card é `basis-full` (mesma largura das seções abaixo dele); o "espiar" dos cards de trás é só `translateY` + `scale`, calculado a cada evento `scroll`/`select`/`reInit` do embla e aplicado via `style` direto no DOM (não via classe/estado do React, para acompanhar o drag a 60fps). Três armadilhas não óbvias encontradas construindo isso:

1. **`scrollProgress()`/`scrollSnapList()` são normalizados em `[0, 1]` sobre o range inteiro do carrossel**, não em "1 unidade por card" — o espaçamento entre pontos de snap adjacentes encolhe conforme mais cards existem (1/3 com 4 cards, 1/9 com 10). É preciso reescalar (`scrollProgress() * (scrollSnapList().length - 1)`) para uma unidade "cards de distância" antes de usar esse valor para profundidade de pilha, senão o efeito visual fica mais fraco quanto mais cartões o usuário tiver.
2. **Nunca ancorar a posição horizontal em `api.selectedScrollSnap()`.** Esse índice é uma função degrau — muda no instante em que o embla decide que o drag cruzou o threshold de snap — enquanto a posição de scroll renderizada (`scrollProgress()`) ainda está em transição nesse exato momento. Ancorar nele produz um salto de uma largura de card inteira bem no meio do drag. A posição horizontal de cada card tem que ser derivada inteiramente da posição contínua (`scrollProgress()`), nunca do índice selecionado.
3. **O viewport do embla (`overflow-hidden`, dentro de `ui/carousel.tsx`) se auto-dimensiona pela altura de layout *não transformada* de cada item.** Um "espiar" via `translateY` não aparece de jeito nenhum (fica cortado) a menos que o item reserve esse espaço via padding real (não via `transform`, que não conta pro cálculo de altura do container).

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

## Uso offline (leitura)

Motivação: sem cache nenhum de dado de API, abrir o app sem rede mostra telas vazias — ruim para um app de bolso, aberto em qualquer lugar. Decisão de escopo: só leitura — os últimos dados sincronizados continuam visíveis sem rede, mas criar/editar segue exigindo conexão. Não há fila de escrita/sincronização em background; isso evita todo o problema de resolver conflito em dado financeiro editado offline.

- Implementado com o suporte oficial de persistência do TanStack Query (`@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`), não com `runtimeCaching` do Workbox — mantém a decisão da seção PWA acima (o service worker nunca cacheia respostas da API) e persiste, em vez disso, o cache do `QueryClient` em si, no `localStorage`. É transparente para os hooks por entidade existentes (`src/hooks/use-*.ts`) — nenhum precisou mudar.
- `src/lib/query-client.ts` exporta `persister` e `CACHE_BUSTER` (string versionada manualmente) além do `queryClient` de sempre; `src/main.tsx` troca `QueryClientProvider` por `PersistQueryClientProvider`, com `maxAge` de 24h e `buster: CACHE_BUSTER`. O buster precisa ser incrementado sempre que o formato de algum dado cacheado mudar, para descartar um cache antigo incompatível em vez de restaurá-lo e quebrar a UI — mesma categoria de cuidado dos gotchas de formulário já documentados acima.
- `src/hooks/use-online-status.ts` expõe `navigator.onLine` de forma reativa (eventos `online`/`offline`); `AppHeader` mostra um badge "Offline" quando a rede cai, para deixar claro que os dados na tela podem estar desatualizados.
- O cache persistido é limpo (`persister.removeClient()`) junto com o token no handler de 401 de `lib/api.ts` — hoje o único ponto de fim de sessão do app (não existe botão de logout na UI); evita vazar dado financeiro de uma sessão anterior num dispositivo compartilhado.

## Docker

`web/Dockerfile` espelha o multi-stage do `backend/Dockerfile`: estágio `dev` (`pnpm dev`, hot reload via bind mount, o mesmo padrão `.:/app` + volume anônimo em `/app/node_modules` do backend) e um estágio `prod` que builda o bundle estático e serve via `nginx` com fallback de SPA (`nginx.conf`, `try_files ... /index.html` — necessário porque rotas do `react-router` como `/extrato` não existem como arquivo em disco).

O `web/` sobe através do `docker-compose.yml` único na raiz do repo (ver [`architecture.md`](./architecture.md#docker) para o detalhamento completo) — não há mais um compose por projeto. `docker compose up --build` (na raiz) sobe backend e web juntos: backend em `localhost:3000`, web em `localhost:5173`.

`vite.config.ts` define `server.host: true` para o dev server bindar em `0.0.0.0` — sem isso, o Vite dentro do container só escuta em `localhost` do próprio container, inacessível a partir do host.

**Gotcha: instalar uma dependência nova no host não basta para o container enxergá-la.** O volume anônimo `/app/node_modules` (declarado no `docker-compose.yml` da raiz para não deixar o bind mount `./web:/app` sobrescrever o `node_modules` instalado na imagem) sobrevive a um `docker compose up --build` sozinho — o container recém-criado reusa o volume antigo, com o `node_modules` de antes da instalação. Depois de rodar `pnpm add <pkg>` (ou `pnpm dlx shadcn@latest add ...`) no host, é preciso `docker compose up --build --force-recreate -V` (o `-V` remove os volumes anônimos) para o container instalar de fato a dependência nova — só `--build` não é suficiente e falha silenciosamente com um erro de import não resolvido no Vite.

## Deploy em produção

O frontend é publicado na **Vercel** (integração nativa com o GitHub, root `web/`, `VITE_API_URL` apontando para o backend no Coolify). O passo a passo está em `docs/deployment.md`. O `web/vercel.json` faz o rewrite de SPA para que deep links não deem 404. O estágio `prod` do `web/Dockerfile` (build estático + `nginx`) continua disponível para quem preferir hospedar o frontend num container.

## Notificações push (lembretes)

Web Push implementado para os lembretes (`/lembretes`, ver `docs/api.md#reminders`):
- Backend: chaves VAPID em env (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` — sem as três, push fica desligado e `/push/config` responde `enabled: false`), tabela `PushSubscription`, lib `web-push`, disparo por cron (`jobs/reminder.job.ts`).
- Web: `hooks/use-push.ts` lê `/push/config`, pede permissão e registra a subscription. O card "Notificações neste dispositivo" na tela de Lembretes mostra o estado (sem suporte, sem SW, servidor desligado, bloqueado, ativo).
- **iOS**: Web Push só funciona no Safari 16.4+ **com o PWA instalado na Tela de Início** — no Safari normal, `PushManager` nem existe (o card mostra a instrução de instalar). A permissão só pode ser pedida a partir de um toque do usuário, por isso o botão "Ativar" em vez de pedir ao abrir a tela.
- **Dev**: no `pnpm dev`, o `vite-plugin-pwa` não registra service worker, então o card mostra "só funciona na versão instalada/build". Para testar push localmente: `pnpm build && pnpm preview` (localhost conta como contexto seguro).
- Clicar na notificação foca uma janela já aberta do app (ou abre uma nova) em `/lembretes`.
- O SW continua **sem** `runtimeCaching` para a API — push não muda isso.

O Discord é o segundo canal, todo no backend (webhook de canal via `DISCORD_WEBHOOK_URL`, sem bot conectado) — ver `docs/deployment.md`.

## Modo demo

Build especial do mesmo app, para portfólio: `pnpm dev:demo` / `pnpm build:demo` (= `vite --mode demo`). Não existe backend: o visitante entra direto (sem login, nome "Visitante"), e os dados ficam no `localStorage` dele (chave `demoDb`).

- **Ponto de troca**: o início de `apiFetch` (`lib/api.ts`). Com `import.meta.env.MODE === 'demo'`, ele delega para `demoFetch` (`src/demo/demo-fetch.ts`), que roteia `método + path` (`src/demo/router.ts` + `routes.ts`) para handlers em `src/demo/handlers/`. Nenhuma tela, hook ou query key sabe que está na demo.
- **Fidelidade**: os handlers espelham os services do backend (mesmos status e mensagens de erro, incluindo o 409 ao excluir conta/categoria em uso). A lógica pura é portada em `src/demo/logic/` com `decimal.js`, a mesma lib do `Prisma.Decimal`, e o dinheiro sai como `"100.5"`, igual ao backend.
- **⚠️ Mudou regra de negócio ou contrato de endpoint no backend → espelhe em `src/demo/`** (handler e/ou `logic/`). Não há testes que detectem a divergência.
- **Seed** (`src/demo/seed.ts`): determinístico (PRNG com seed fixa) e relativo à data de hoje. As datas dos lançamentos ficam ao meio-dia UTC, porque a UI formata datas no fuso local e meia-noite UTC apareceria como o dia anterior em UTC-3. Ao mudar o seed ou o formato do `DemoDb`, faça bump em `DEMO_DB_VERSION` para descartar bancos salvos antigos.
- **Jobs**: o equivalente ao startup do backend (`ensureHorizon` dos gastos fixos e avanço dos lembretes vencidos, sem notificar) roda a cada carregamento (`src/demo/jobs.ts`).
- **Fora do bundle de produção**: todo `import()` de `src/demo/` fica atrás de `import.meta.env.MODE === 'demo'` **escrito inline**, para o bundler eliminar o chunk. Para conferir: `pnpm build && grep -rl demo.local dist` não pode achar nada.
- **Push/lembretes**: `/push/config` responde desligado (`server-disabled` no `use-push.ts`) e "testar lembrete" responde que nenhum canal está configurado.
- **Reset**: banner no topo (`components/demo-banner.tsx`) → `resetDemo()`, que apaga o `demoDb` e o cache persistido do TanStack Query e recarrega a página.
- **Testando localmente com `pnpm preview`**: o service worker do PWA serve o build anterior no primeiro carregamento depois de um rebuild. Para ver o build novo, desregistre o SW (DevTools → Application) ou recarregue duas vezes.

## O que ainda não existe

- Testes automatizados no `web/` — decisão deliberada por ora (diferente do `backend/`, que usa Vitest); a arquitetura (funções puras em `lib/`, hooks isolados) foi montada para não bloquear adicionar testes depois, mas nenhum existe hoje.
- Ícones de marca reais (os atuais são placeholders sólidos gerados por script).
