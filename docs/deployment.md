# Deploy (Coolify + Vercel + GitHub Actions)

## Visão geral

- **Backend** (`backend/`): roda como container Docker numa VPS gerenciada pelo **Coolify**, construído a partir do target `prod` do `backend/Dockerfile`.
- **Frontend** (`web/`): publicado na **Vercel** pela integração nativa com o GitHub, sem nenhum passo de CI próprio.
- **GitHub Actions** liga as duas pontas. Em todo PR, faz lint, typecheck e testes dos dois projetos. Em todo push na `main`, repete essas checagens e chama um **webhook de deploy do Coolify** para atualizar o backend. O auto-deploy por push do próprio Coolify precisa ficar **desligado**, para que o webhook (que só dispara com o CI verde) seja a única coisa que publica o backend.

> ⚠️ A configuração do Coolify e da Vercel abaixo foi escrita antes do primeiro deploy real. Confira cada passo na interface do Coolify e da Vercel (que pode ser um pouco diferente do descrito) em vez de copiar cegamente. O checklist de "Verificação pós-deploy" no fim existe justamente para pegar o que não funcionar na primeira vez.
>
> A imagem Docker `prod` em si (build → migrate → serve, descrita abaixo) foi verificada localmente: `docker build --target prod backend` builda sem erros, e o container resultante aplica as migrations pendentes com `prisma migrate deploy` e depois responde `/health`. Essa parte funciona; o que não foi testado é a ligação com o Coolify e a Vercel em volta dela.

## Mudanças no backend que fazem isso funcionar

Duas mudanças já feitas no `backend/` para que a imagem `prod` migre o banco e suba corretamente. Não é preciso fazer nada; estão documentadas aqui para ficar claro por que existem:

- O `CMD` do estágio `prod` do `backend/Dockerfile` roda `pnpm prisma:deploy && node dist/src/server.js`, não só `node dist/src/server.js`. Sem isso, as migrations nunca chegariam em produção automaticamente. O `prisma migrate deploy` é idempotente (não faz nada se não houver migration pendente), então é seguro rodar a cada start do container.
- O `prisma` saiu de `devDependencies` e foi para `dependencies` no `backend/package.json`. O estágio `prod` instala com `pnpm install --prod`, que pula `devDependencies`; com o `prisma` lá, tanto o `postinstall: prisma generate` do build quanto o `prisma:deploy` em runtime falhariam com `prisma: not found`.

## Configuração inicial

Siga na ordem: passos posteriores dependem de decisões tomadas antes. Em especial, as variáveis de WebAuthn do backend dependem do domínio final do frontend, então só preencha essas no passo 6.

1. **Defina os domínios** (ou aceite os padrões). Escolha um domínio para o backend, ex. `api.example.com`, e um para o frontend, ex. `app.example.com` (ou use o domínio `*.vercel.app` que a Vercel atribui, se ainda não tiver domínio próprio). Troque os exemplos abaixo pelos seus valores reais.

2. **Confirme o acesso ao Coolify** na VPS que vai hospedar o backend (só para garantir que você consegue criar um recurso novo nele).

3. **Crie um recurso/aplicação novo no Coolify** para o backend:
   - Conecte ao seu repositório no GitHub (pelo GitHub App/integração do Coolify).
   - Build pack: Dockerfile.
   - Aponte o Coolify para `backend/Dockerfile`, target `prod`.

4. **Desligue o auto-deploy por push do Coolify** para esse recurso. Os deploys devem acontecer só pelo webhook do GitHub Actions (passo 13), depois que o CI passar. Isso é o contrário do padrão do Coolify, então não pule este passo.

5. **Configure um volume/armazenamento persistente** no Coolify para o banco SQLite: caminho de montagem `/app/data` (não `/app/prisma`, ver o aviso abaixo).

   > ⚠️ **Nunca monte o volume persistente em `/app/prisma`.** Um volume persistente só é populado a partir da imagem na *primeira* vez que é criado. Depois disso, o conteúdo do volume esconde tudo o que a imagem trouxer para o mesmo caminho, inclusive pastas novas em `prisma/migrations`. Cada push depois do primeiro deploy geraria uma imagem com uma migration nova, mas o container continuaria vendo só as migrations antigas do volume, e o `prisma migrate deploy` silenciosamente não aplicaria nada. Isso já aconteceu em produção uma vez (setembro de 2026). Montar em `/app/data`, batendo com o `DATABASE_URL` do passo 6, mantém `schema.prisma` e `migrations` sempre vindo da imagem nova a cada deploy, porque o volume cobre só a pasta do arquivo do banco. O checklist de verificação pós-deploy tem uma checagem explícita de que os dados *e as migrations novas* sobrevivem a um redeploy; não pule.

6. **Preencha as variáveis de ambiente do backend na interface do Coolify** (não num `.env` commitado; o `backend/.env` está no `.gitignore`, então o Coolify precisa fornecer essas variáveis diretamente):

   | Variável | Valor | Observações |
   |---|---|---|
   | `DATABASE_URL` | `file:./data/dev.db` | Relativo ao diretório de trabalho `/app` do container; persistido pelo volume do passo 5. **Não** pode apontar para dentro de `prisma/` (ver aviso do passo 5). |
   | `AUTH_PASSWORD` | uma senha nova, só para produção | Não reaproveite a senha do ambiente local. |
   | `AUTH_TOKEN_SECRET` | saída de `openssl rand -base64 32` | Assina o token de autenticação (HMAC-SHA256). |
   | `AUTH_USER_NAME` | ex. `Fulano` | Opcional, cosmético: alimenta a saudação "Olá, {nome}". |
   | `WEBAUTHN_RP_ID` | hostname puro do domínio do **frontend**, ex. `app.example.com` | Ver aviso abaixo. |
   | `WEBAUTHN_RP_NAME` | ex. `Meu Dinheirinho` | Cosmético, aparece no prompt de Face ID/Touch ID do sistema. |
   | `WEBAUTHN_ORIGIN` | origem HTTPS completa do **frontend**, ex. `https://app.example.com` | Ver aviso abaixo. |
   | `REMINDERS_TZ` | `America/Sao_Paulo` (padrão, pode omitir) | Fuso em que dia e horário dos lembretes são interpretados. |
   | `WEB_APP_URL` | origem HTTPS do frontend, ex. `https://app.example.com` | Opcional: faz o título do embed no Discord apontar para `/lembretes`. |
   | `DISCORD_WEBHOOK_URL` | URL do webhook do canal | Opcional. Discord → configurações do canal → Integrações → Webhooks → Novo webhook → Copiar URL. Sem ela, o canal Discord fica desligado. |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | saída de `npx web-push generate-vapid-keys` | Opcional, mas as três variáveis VAPID são necessárias para o Web Push. Gere uma vez e guarde: trocar as chaves invalida a inscrição de todos os dispositivos. |
   | `VAPID_SUBJECT` | `mailto:voce@example.com` | URL de contato exigida pelos serviços de push. |
   | `NODE_ENV` | `production` | |
   | `PORT` | `3000` (padrão, pode omitir) | |

   > ⚠️ **`WEBAUTHN_RP_ID` e `WEBAUTHN_ORIGIN` precisam bater com o domínio do frontend na Vercel, não com o domínio do próprio backend no Coolify.** O WebAuthn valida contra a origem em que o navegador está rodando (o frontend), mesmo essas variáveis morando no backend (onde o `@simplewebauthn/server` faz a validação). Inverter isso é o erro mais fácil de cometer aqui, e ele falha **em silêncio**: o Face ID/Touch ID simplesmente não funciona, sem nenhum erro óbvio apontando a causa.

7. **Configure o domínio do backend** no Coolify (`api.example.com`, do passo 1) e deixe o Coolify emitir o HTTPS via Let's Encrypt.

8. **Configure o health check do Coolify** para chamar `GET /health` (rota pública, sem autenticação, responde `{"status":"ok"}`).

9. **Dispare um deploy manual pela interface do Coolify** para inicializar o recurso. Isso confirma que a imagem builda e o container sobe (incluindo o passo de migration `prisma:deploy` embutido no `CMD` do Dockerfile) antes de ligar qualquer automação. Confirme que `curl https://api.example.com/health` responde ao final.

10. **Crie o projeto na Vercel** para o frontend: importe este repositório, defina o root directory como `web/` e deixe a Vercel detectar o preset do Vite. Mantenha as configurações de build e output padrão: o `web/vite.config.ts` não tem `base` customizado e usa o `outDir: dist` padrão, que é exatamente o que o preset do Vite na Vercel espera. O `web/vercel.json` faz o rewrite de SPA para que deep links (ex. `/extrato`) não deem 404.

11. **Configure a variável de ambiente da Vercel** `VITE_API_URL` com a URL HTTPS real do backend do passo 7 (ex. `https://api.example.com`). Defina nos escopos Production e Preview se quiser que os deploys de preview dos PRs também falem com o backend real. É uma variável de **build**: o Vite embute `import.meta.env.VITE_API_URL` no bundle estático durante o `vite build`, então ela precisa existir antes do primeiro build, não pode ser injetada em runtime.

12. **Configure o domínio da Vercel** (o `app.example.com` do passo 1, ou o `*.vercel.app` padrão). Se o domínio final for diferente do que você assumiu no passo 6, volte e corrija `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` no Coolify.

13. **Gere um webhook de deploy no Coolify** para o recurso do backend (Settings → Webhooks, ou equivalente). Copie o comando `curl` exato que o Coolify mostrar, porque o mecanismo de autenticação (bearer token ou token embutido na URL) precisa ser confirmado na sua versão do Coolify, não presumido.

14. **Adicione os secrets do repositório no GitHub** (Settings → Secrets and variables → Actions): `COOLIFY_WEBHOOK_URL` e `COOLIFY_WEBHOOK_TOKEN`, do passo 13.

15. **Garanta que os dois workflows** em `.github/workflows/ci.yml` e `.github/workflows/deploy.yml` (ver "Como o pipeline funciona" abaixo) estejam na `main`.

16. **Adicione uma regra de proteção na `main`** exigindo que os jobs `backend-ci` e `web-ci` do `ci.yml` passem antes do merge de um PR. É isso que torna o "gate de qualidade antes do deploy" obrigatório, e não só informativo.

17. **Faça o merge de um PR descartável** para exercitar o pipeline de ponta a ponta pela primeira vez, e depois percorra o checklist de verificação pós-deploy abaixo.

## Demo (projeto separado na Vercel)

A demo é o mesmo `web/` construído com `--mode demo`: sem backend, com dados fictícios no `localStorage` de cada visitante (ver `docs/web-architecture.md#modo-demo`).

1. Na Vercel, **Add New → Project** e importe este mesmo repositório (um segundo projeto, ex. `meu-dinheirinho-demo`).
2. **Root Directory**: `web/`. Framework preset: Vite.
3. **Build Command**: `pnpm build:demo` (override). Output: `dist` (padrão).
4. **Não** configure `VITE_API_URL`: a demo não chama nenhuma API.
5. Deploy. A integração nativa com o GitHub faz deploy automático a cada push na `main`, igual ao projeto de produção.
6. Coloque a URL gerada no link "Abrir a demo" do `README.md`.

O `web/vercel.json` (rewrite de SPA) vale para os dois projetos: abrir direto um link como `/extrato` não dá 404.

## Como o pipeline funciona

- **`.github/workflows/ci.yml`** roda em todo pull request para a `main`. São dois jobs independentes, `backend-ci` e `web-ci`, que sempre rodam, independente de qual projeto o PR toca (mantido simples, sem filtro por caminho, já que o CI é barato). Cada um instala as dependências, faz lint e typecheck; o backend roda também a suíte do Vitest. O web não tem framework de testes, então `pnpm build` e `pnpm build:demo` são a checagem de corretude dele.
- **`.github/workflows/deploy.yml`** roda em todo push na `main` (ou seja, depois do merge de um PR). Repete as mesmas checagens `backend-ci`/`web-ci` e depois um job `deploy-backend` (com `needs: [backend-ci, web-ci]`) chama o webhook do Coolify via `curl`. Exigir as checagens dos dois projetos, mesmo só o backend sendo publicado aqui, garante que um build quebrado do frontend na `main` não passe despercebido só porque as checagens do backend passaram.
- **A Vercel não tem job em nenhum dos workflows.** A integração nativa dela com o GitHub (instalada no passo 10) faz deploy automático a cada push na `main` e cria um deploy de preview para cada PR. Esse é o fluxo idiomático da Vercel, e reimplementar isso com a CLI da Vercel no Actions seria redundante.

## Verificação pós-deploy

Percorra todos os itens depois do primeiro deploy real:

1. `curl https://api.example.com/health` → `{"status":"ok"}`.
2. Confira nos logs do container no Coolify a saída do `prisma:deploy` no startup: as migrations precisam aparecer aplicadas (ou "No pending migrations"), e não falhando em silêncio enquanto o `node dist/src/server.js` sobe mesmo assim.
3. Faça login com a senha a partir do frontend publicado (`https://app.example.com`). Isso confirma que `AUTH_PASSWORD`/`AUTH_TOKEN_SECRET` estão certos e que as chamadas cross-origin da Vercel para o Coolify funcionam (o CORS do backend é totalmente aberto, então não precisa de configuração extra).
4. Registre uma credencial WebAuthn (Face ID/Touch ID) a partir do frontend publicado, saia e entre de novo com ela. É o passo com mais chance de falhar se `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` estiverem com o domínio errado (passo 6) ou se os domínios mudaram depois (passo 12).
5. Faça o merge de um PR descartável na `main` e confirme: o `ci.yml` rodou no PR, o `deploy.yml` rodou no push do merge, o webhook do Coolify disparou (aparece no histórico de deploys do Coolify) e o backend recebeu a mudança.
6. **Checagem de persistência do volume**: crie um registro de teste pelo app, dispare um redeploy (pelo webhook de novo, ou pelo botão "Redeploy" do Coolify) sem mudança de schema, e confirme que o registro continua lá. Se sumiu, o volume em `/app/data` não está persistindo entre redeploys: confira se a configuração de volume do Coolify realmente monta `/app/data` e se um redeploy não recria o container com um volume novo por padrão.

## Corrigindo um deploy existente com o volume montado em `/app/prisma`

Se o Coolify já foi configurado com o armazenamento persistente em `/app/prisma` (o erro descrito no aviso do passo 5) e as migrations novas pararam de chegar em produção, migre para `/app/data` sem perder dados:

1. No Coolify, **adicione um segundo armazenamento persistente** para o mesmo recurso: destino `/app/data`, com um volume novo. Deixe o `/app/prisma` existente onde está por enquanto.
2. **Faça um redeploy** para o container subir com os dois volumes montados (`/app/prisma` com os dados antigos, `/app/data` vazio).
3. Abra o terminal do container em execução no Coolify (ou entre na VPS por SSH e use `docker exec`) e rode:
   ```bash
   mkdir -p /app/data
   cp /app/prisma/dev.db /app/data/dev.db
   ```
4. Atualize a variável `DATABASE_URL` para `file:./data/dev.db` (passo 6 acima).
5. **Faça outro redeploy.** Confira nos logs do container o passo `prisma:deploy`: ele deve mostrar as migrations que estavam faltando sendo aplicadas, e `GET /health` deve continuar funcionando. Confira por amostragem que os dados existentes (contas, transações, categorias) continuam lá.
6. Depois de confirmar, **remova o armazenamento antigo em `/app/prisma`** no Coolify, para que os próximos deploys parem de montá-lo (e de esconder a pasta da imagem).
