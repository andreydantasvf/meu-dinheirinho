# Meu Dinheirinho — Mobile

App em React Native + Expo (SDK 54, Expo Router file-based) + NativeWind (Tailwind) + TanStack Query.

**Fixado no Expo SDK 54 de propósito**: é a versão que o app **Expo Go da App Store/Play Store** roda hoje. SDKs mais novos (55+) ainda não têm o Expo Go aprovado nas lojas, então testar em dispositivo físico exigiria conta paga de desenvolvedor Apple ou build local via Xcode. Com SDK 54, basta o Expo Go grátis.

## Requisitos

- Node 24.x + pnpm
- App **Expo Go** instalado no celular (grátis, App Store/Play Store)
- Celular na mesma rede Wi-Fi do computador

## Testando no seu iPhone

```bash
cp .env.example .env   # já feito no setup inicial — ajuste o IP se sua rede mudar
pnpm start
```

Isso abre o Metro Bundler no terminal com um QR code. No iPhone, abra o app **Câmera** (não precisa ser dentro do Expo Go) e aponte para o QR code — ele reconhece automaticamente e oferece abrir no Expo Go. O app carrega direto no celular, com hot reload: qualquer alteração salva em `app/` ou `lib/` atualiza a tela na hora.

Se o QR code não conectar (ex. rede corporativa/VPN bloqueando), rode `pnpm start --tunnel` (mais lento, mas passa por qualquer rede).

Outras opções:
- `pnpm ios` — abre no simulador do iOS (precisa Xcode instalado)
- `pnpm web` — abre no navegador

## Estrutura

```
app/                     # rotas (Expo Router, file-based)
├── _layout.tsx          # Stack raiz + QueryClientProvider
├── (tabs)/               # Home, Extrato, Cartões, Categorias
├── nova-transacao.tsx             # modal
└── nova-compra-parcelada.tsx      # modal
lib/
├── api.ts               # cliente fetch simples (usa EXPO_PUBLIC_API_URL)
└── query-client.ts       # instância do TanStack Query
global.css               # diretivas @tailwind
```

Todas as telas são placeholders — a Home é a exceção, com uma chamada real ao `/health` do backend via TanStack Query, provando a integração ponta a ponta.

## Conectando com o backend

`EXPO_PUBLIC_API_URL` no `.env` precisa ser o **IP da rede local do seu computador** (ex. `http://192.168.0.17:3000`), não `localhost` — rodando em um dispositivo físico via Expo Go, `localhost` aponta para o próprio celular, não para o seu Mac. Para descobrir o IP: `ipconfig getifaddr en0`. O backend (`docker compose up` na pasta `backend/`) precisa estar rodando para a Home mostrar "API: ok".

Exceção: rodando no **simulador iOS**, `localhost` funciona normalmente (o simulador compartilha a rede do Mac).

Se o IP da sua rede mudar (ex. trocou de Wi-Fi), atualize o `.env` e reinicie o `pnpm start`.

## Notas técnicas

- **pnpm + Metro**: o `.npmrc` define `node-linker=hoisted`. O bundler do React Native (Metro) não lida bem com o node_modules simbólico/isolado padrão do pnpm — o modo hoisted deixa o node_modules "achatado", compatível com o Metro. Não remova essa configuração.
- **NativeWind**: classes Tailwind funcionam via prop `className` nos componentes RN (`View`, `Text`, etc.), configurado em `babel.config.js` + `metro.config.js` + `tailwind.config.js`.
- Depois de mudar `tailwind.config.js` ou `babel.config.js`, rode `npx expo start -c` para limpar o cache do Metro caso os estilos não atualizem.
- Quando quiser subir de SDK no futuro (`npx expo install expo@latest` + `npx expo install --fix`), verifique antes se o Expo Go da loja já suporta a nova versão — senão o QR code para de funcionar até você migrar para um dev client.
