# Spec: App público — pacote self-host + demo interativa sem backend

- **Data**: 2026-10-11
- **Status**: aprovado em brainstorming, aguardando plano de implementação
- **Branch**: `12-transformar-app-publico`
- **Relacionado**: [`docs/web-architecture.md`](../../web-architecture.md), [`docs/api.md`](../../api.md), [`docs/deployment.md`](../../deployment.md)

## Contexto

O meu-dinheirinho vai virar um repositório público para portfólio e GitHub. São dois objetivos:

1. **Self-host**: qualquer pessoa consegue clonar o repo e subir a própria instância single-user (via `docker compose` ou Coolify + Vercel) seguindo só o README. **Não** é um projeto "open-source aberto a contribuições" e **não** é um SaaS multi-usuário.
2. **Demo para portfólio**: uma versão do app na Vercel que um recrutador abre, entra sem senha, vê dados realistas e entende o produto em menos de 1 minuto. Sem banco de dados real e sem API real.

Levantamento do estado atual (feito no brainstorming):

- Histórico do git limpo: nenhum `.env` commitado, `AUTH_PASSWORD` só aparece como `"change-me"`, nenhum IP/domínio pessoal em arquivos versionados. O repo pode ficar público sem reescrever histórico.
- **Toda** chamada ao backend no `web/` passa por `apiFetch` (`web/src/lib/api.ts`), inclusive WebAuthn (`lib/webauthn.ts`) e push (`hooks/use-push.ts`). Não existe `fetch` direto em outro lugar.
- A regra de negócio relevante do backend está em 4 arquivos puros (cerca de 370 linhas no total): `report-calculations.ts`, `purchase-installments.ts`, `fixed-expense-generator.ts`, `reminder-schedule.ts`. A única dependência deles é `Prisma.Decimal`, que é `decimal.js` por baixo.
- O backend expõe cerca de 42 endpoints (ver `docs/api.md`).
- Gastos fixos: `POST /fixed-expenses` gera de imediato as transações dos próximos `HORIZON_MONTHS` (12). O job `ensureHorizon()` roda diariamente à 00:00 **e uma vez no startup** para estender o horizonte dos gastos ativos (`backend/src/jobs/fixed-expense.job.ts`).
- Não existe `web/vercel.json`, então um deep link (`/extrato`) aberto no primeiro acesso pode dar 404 na Vercel.

## Decisões de design

1. **Idioma**: tudo em pt-BR (README, docs, UI). Sem i18n.
2. **Licença**: MIT. Sem licença, um repo público é juridicamente "todos os direitos reservados" e terceiros não teriam permissão para hospedar a própria instância. A MIT não obriga a aceitar contribuições.
3. **Demo interativa e persistida no navegador**: o visitante cria, edita e exclui de verdade (transações, compras parceladas, gastos fixos, lembretes, contas, categorias). Saldos e faturas recalculam. Os dados ficam no `localStorage` do próprio visitante, e um botão "Resetar dados" volta ao estado inicial.
4. **API falsa no navegador, ligada no `apiFetch`**: descartados (a) MSW, que precisaria de um service worker próprio em conflito com o `sw.ts` do PWA sem trazer ganho, já que existe um ponto único de troca, e (b) um backend real com banco efêmero, que teria estado compartilhado entre visitantes, hospedagem, cron e cold start.
5. **A demo é o mesmo app `web/`** num build com flag, não um projeto separado. Assim ela não fica defasada em relação ao app real.
6. **Zero impacto no build normal**: o código da demo entra por `import()` dinâmico atrás de uma flag de build. No build de produção, o Vite elimina o bloco e `web/src/demo/` não entra no bundle.
7. **Sem testes no frontend**: o `web/` continua sem framework de testes. A segurança vem de `tsc`, lint e `build:demo` no CI, mais validação manual no Playwright. O risco de a lógica portada divergir do backend é mitigado por uma regra documentada (ver seção 5).
8. **Nada muda no backend**, a não ser `.env.example` e docs.

## Design

### 1. Pacote self-host

1. **`README.md` da raiz reescrito em pt-BR**, nesta ordem:
   - o que é o app e o link da demo
   - screenshots (tiradas da demo)
   - funcionalidades
   - stack
   - quick start com Docker (`docker compose up --build`)
   - tabela de variáveis de ambiente (backend e web)
   - como fazer deploy (link para `docs/deployment.md`)
   - instalação no iPhone (PWA) e limitações conhecidas: single-user, WebAuthn exige HTTPS e domínio real, push só funciona no build
   - como rodar a demo localmente (`pnpm dev:demo`)
   - licença
2. **`LICENSE`** (MIT) na raiz.
3. **`.env.example` neutros**:
   - `backend/.env.example`: `AUTH_USER_NAME=""` (hoje `"Andrey"`), com todos os comentários em pt-BR (hoje misturam inglês e português).
   - `web/.env.example`: comentário em pt-BR.
4. **`docs/deployment.md` traduzido para pt-BR e revisado** para servir a um terceiro: explicar como gerar `AUTH_TOKEN_SECRET` (`openssl rand -base64 32`) e as chaves VAPID (`npx web-push generate-vapid-keys`), tirar qualquer referência ao setup pessoal e adicionar a seção "Demo" (ver seção 4).
5. **`Meu Dinheirinho.dc.html`** sai da raiz e vai para `docs/design/` como registro do protótipo de design.

**Fora do escopo:** multi-usuário/cadastro, seed de categorias padrão para instâncias novas (uma instalação nova continua começando vazia), CONTRIBUTING e templates de issue/PR, i18n.

### 2. Arquitetura do modo demo

**Flag**: `VITE_DEMO_MODE=true`. Um novo `web/src/lib/demo-mode.ts` exporta:

```ts
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
```

Declarar `VITE_DEMO_MODE` em `vite-env.d.ts`.

**Ponto de troca**: no início do `apiFetch` (`web/src/lib/api.ts`):

```ts
if (IS_DEMO) {
  const { demoFetch } = await import('@/demo/demo-fetch');
  return demoFetch<T>(path, options);
}
```

**Estrutura em `web/src/demo/`:**

| Arquivo | Responsabilidade |
|---|---|
| `demo-fetch.ts` | Parse de método, path e query string. Faz `JSON.parse` do body, que o `apiFetch` recebe como objeto. Despacha via `router.ts`. Converte `DemoHttpError(status, message)` em `ApiError` com o mesmo status e mensagem que o backend devolveria, então os toasts de erro da UI funcionam igual. Retorna `undefined` onde o backend responde 204. Persiste o store depois de toda mutação. Os dados devolvidos são cópias (`structuredClone`), nunca referências do store, para que o cache do TanStack Query não altere o "banco". |
| `router.ts` | Tabela `{ method, pattern, handler }` com padrões estilo `/accounts/:id/fatura`. Cobre todos os endpoints de `docs/api.md` que o `web/` usa. Path desconhecido → `DemoHttpError(404)`. |
| `handlers/<entidade>.ts` | Um arquivo por entidade, espelhando os services do backend (`account`, `category`, `transaction`, `purchase`, `fixed-expense`, `reminder`, `reports`, `push`, `auth`). Reproduz as regras de negócio e as validações que a UI consegue disparar: mesmos códigos HTTP e mesmas mensagens de erro do backend, por exemplo ao excluir categoria/conta em uso, cancelar gasto fixo (apaga só transações com data ≥ hoje e desativa lembretes ligados), e criar ou excluir compra parcelada (gera ou remove as N parcelas). |
| `logic/` | Port dos 4 arquivos puros do backend, trocando `Prisma.Decimal` por `decimal.js` (nova dependência do `web/`). Dinheiro sai como `Decimal.toString()`, reproduzindo exatamente a serialização do backend (`"100.5"`, não `"100.50"`). O `ensureHorizon` do `fixed-expense.service.ts` também é portado aqui. |
| `store.ts` | O "banco" da demo: `{ version, accounts, categories, transactions, purchases, fixedExpenses, reminders }` salvo no `localStorage` (chave `demoDb`). No primeiro carregamento, ou se a `version` salva for diferente da atual, regenera a partir do seed. Ids novos vêm de `crypto.randomUUID()`. A cada carregamento roda o `ensureHorizon()` portado (o equivalente ao "startup" do backend) e avança os `proximoDisparo` vencidos dos lembretes ativos para a próxima ocorrência, sem notificar. `resetDemo()` apaga o `demoDb`, limpa o cache persistido do TanStack Query (`persister.removeClient()`, `queryClient.clear()`) e recarrega a página. |
| `seed.ts` | Gera os dados iniciais relativos à data atual (ver seção 3). |

**Pontos de UI que checam `IS_DEMO`** (únicos lugares fora de `demo/` que mudam):

- **Auth** (`lib/auth.ts`): na demo, `isLoggedIn()` retorna `true` e `getUserName()` retorna `"Visitante"`. A rota `/login` redireciona para `/`. O fluxo de WebAuthn nunca aparece.
- **Push**: o handler de `GET /push/config` responde `{ enabled: false, publicKey: null }`, o mesmo formato do backend sem chaves VAPID. Com isso, `use-push.ts` cai no status `server-disabled`, que já existe, e nenhum código de push precisa mudar. `POST /push/subscriptions` responde `503`, como no backend sem VAPID. `POST /reminders/:id/test` responde sucesso sem notificar.
- **Banner de demo**: componente novo e discreto (no `AppHeader` no mobile e na sidebar desktop) com o texto "Modo demo · dados fictícios salvos só neste navegador" e um botão **Resetar dados**. O botão abre um `AlertDialog` do shadcn (não um `confirm()` nativo) e chama `resetDemo()`.
- **Título/meta**: na demo, o `<title>` e a meta description levam "(demo)".
- **PWA**: continua ativo na demo (instalável). Nenhuma mudança no `sw.ts`.

**Não muda**: nenhuma tela, nenhum hook, nenhum query key, nada no backend.

### 3. Seed e UX da demo

O seed é **determinístico**: um gerador pseudoaleatório com seed fixa, de modo que todo visitante vê os mesmos dados e o reset volta sempre ao mesmo estado, relativo à data atual. As datas são calculadas a partir de hoje para que o mês corrente sempre tenha movimento.

**Persona**: "Visitante", com histórico cobrindo 2 meses passados, o mês atual e o próximo, mais as parcelas futuras.

- **Contas**: "Conta principal" (conta corrente), "Carteira" (dinheiro) e **2 cartões de crédito** com cores, dia de fechamento/vencimento e limite diferentes.
- **Categorias**: cerca de 10 de despesa (Mercado, Restaurantes, Transporte, Moradia, Lazer, Saúde, Assinaturas, Educação, Compras, Outros) com ícone e cor. Algumas têm meta mensal, e pelo menos uma está estourada no mês atual para exibir o alerta de meta. Mais cerca de 2 de receita (Salário, Freela).
- **Transações**: salário mensal mais cerca de 25 despesas por mês, com valores e descrições plausíveis e distribuídas entre os dias e as contas.
- **Compras parceladas**: 3, em estágios diferentes (uma começando no mês atual, uma no meio, uma quase terminando), criadas pela mesma lógica do handler (`purchase-installments`).
- **Gastos fixos**: 3 a 4 (aluguel, streaming, academia, …), criados pela mesma lógica do handler (`fixed-expense-generator` + horizonte de 12 meses).
- **Lembretes**: 3, sendo um ligado a um gasto fixo, um recorrente mensal e um de data única no futuro.

**UX**: ao abrir a demo, o visitante já entra na Home com dados, sem tela de login e sem onboarding.

### 4. Build, deploy e CI

- **`web/.env.demo`** (versionado; não é afetado pelo `.gitignore`) com `VITE_DEMO_MODE=true`.
- **Scripts em `web/package.json`**: `dev:demo` (`vite --mode demo`) e `build:demo` (`tsc -b && vite build --mode demo`, espelhando o `build` atual). Qualquer pessoa roda a demo localmente sem backend.
- **`web/vercel.json`** com rewrite de SPA (`/(.*)` → `/index.html`), que serve tanto ao projeto de produção quanto ao da demo.
- **Segundo projeto na Vercel** (ex.: `meu-dinheirinho-demo`): mesmo repo, root `web/`, build command `pnpm build:demo`, sem `VITE_API_URL`. Deploy automático a cada push na `main` pela integração nativa do GitHub, igual à produção. A configuração do projeto é manual e documentada em `docs/deployment.md`, seção "Demo".
- **CI** (`.github/workflows/ci.yml` e `deploy.yml`): o job `web-ci` passa a rodar também `pnpm build:demo`.

### 5. Documentação

- **`docs/web-architecture.md`**: nova seção "Modo demo" descrevendo a seção 2 deste spec, com a regra: **mudou regra de negócio ou contrato de endpoint no backend → espelhe em `web/src/demo/` (handler e/ou `logic/`)**.
- **`CLAUDE.md`**: um parágrafo curto sobre o modo demo (flag, `web/src/demo/`, `dev:demo`/`build:demo`) com o mesmo aviso de espelhamento.
- **`docs/deployment.md`**: traduzido e com a seção "Demo" (ver seção 1.4 e seção 4).
- **`docs/web-architecture.md`**: o trecho "Deploy em produção (planejado, ainda não executado)", que ainda descreve Coolify/nginx para o frontend, é atualizado para Vercel. Já é uma pendência registrada em `docs/deployment.md` e vai ser tocado nesta feature de qualquer forma.

## Verificação

Sem testes automatizados no frontend (decisão 7). A feature é considerada pronta quando:

1. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` e `pnpm build:demo` passam no `web/`, e o CI roda `build:demo`.
2. O bundle de `pnpm build` (produção) não contém código de `web/src/demo/`. Verificar procurando no `dist/` uma string única do seed.
3. **Roteiro manual no Playwright** sobre `pnpm build:demo && pnpm preview`, em viewport mobile e desktop:
   - Abre direto na Home com dados, saudação "Olá, Visitante", banner de demo visível e `/login` redirecionando para `/`.
   - Home: saldo do mês, gasto por categoria com meta estourada, fatura atual por cartão.
   - Extrato: filtros por mês, categoria e conta.
   - Cartões: carrossel, itens da fatura atual, faturas futuras com parcelas, limite disponível.
   - Categorias e Lembretes listam o seed.
   - Criar transação → saldo e extrato atualizam. Criar compra parcelada → parcelas aparecem nas faturas futuras. Criar/cancelar gasto fixo → transações futuras somem e lembrete ligado é desativado. Editar e excluir funcionam. Os erros de regra de negócio (ex.: excluir categoria em uso) mostram o toast certo.
   - Recarregar a página mantém as mudanças. "Resetar dados" volta ao estado inicial.
   - Deep link (`/extrato`) aberto direto funciona.
4. A produção (`pnpm dev` com backend) continua funcionando como antes: login, uma leitura e uma escrita.

## Fora do escopo

- Multi-usuário, cadastro, SaaS.
- i18n.
- Testes automatizados no `web/`.
- Compartilhar código entre `backend/` e `web/`, porque os projetos continuam independentes. A duplicação da lógica em `web/src/demo/logic/` é aceita e mitigada pela regra documentada.
- **Bug observado no backend, a tratar separadamente**: `ensureHorizon()` calcula o próximo mês a partir da última transação gerada (`addMonthsClamped(latestDate, 1)`), não da `dataInicio`. Um gasto fixo no dia 31 vira dia 28 depois de fevereiro e fica no 28 dali em diante. O port na demo reproduz o comportamento atual do backend, sem corrigir.
