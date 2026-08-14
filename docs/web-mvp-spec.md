# Meu Dinheirinho — Web (PWA)

Especificação de produto do app web, que substitui o app mobile React Native/Expo planejado originalmente. Ver [`mvp-spec.md`](./mvp-spec.md) para a visão de produto completa (inalterada) e [`web-architecture.md`](./web-architecture.md) para as decisões técnicas.

## Por que web em vez de mobile nativo

O app foi planejado inicialmente como React Native + Expo. A publicação na App Store se mostrou um bloqueio de progresso (conta de desenvolvedor, revisão, distribuição) para um app pessoal de uso único. Como o `mobile/` existente não tinha nenhuma tela real implementada (só um health-check de prova de conceito na Home), a troca de stack não teve custo de migração de funcionalidades — só de intenção de produto.

A solução: um PWA (Progressive Web App) em Vite + React, instalável no iPhone via Safari → "Adicionar à Tela de Início", com a mesma experiência de app nativo (tela cheia, ícone próprio, sem a barra de navegador) sem passar pela App Store.

## Escopo do MVP (idêntico ao mobile — ver `mvp-spec.md`)

As 6 telas e o modelo de dados são os mesmos definidos em [`mvp-spec.md`](./mvp-spec.md):
1. Home/Dashboard
2. Nova transação
3. Nova compra parcelada
4. Extrato
5. Cartões
6. Categorias (CRUD simples)

Estado atual: as 6 telas têm lógica de negócio real e completa contra o backend, além de um design system próprio (shadcn/ui, dark/light mode, TanStack Query, formulários com react-hook-form + zod) — ver [`web-architecture.md`](./web-architecture.md#design-system-e-camada-de-dados) para os detalhes técnicos.

## Autenticação (novo — não existia no mobile)

Como o app passa a ser acessado pela internet pública (não só numa rede local de desenvolvimento), o MVP ganhou uma camada mínima de segurança, single-user:

1. **Login por senha**: uma senha única (`AUTH_PASSWORD` no backend) troca por um token de acesso, válido por 90 dias, enviado em toda requisição subsequente no header `x-api-token`.
2. **Desbloqueio por Face ID/Touch ID**: logo após o primeiro login por senha, o app oferece registrar um autenticador de plataforma (WebAuthn) no dispositivo. Nas próximas aberturas, o usuário pode reautenticar com biometria em vez de digitar a senha.

Não há multiusuário, cadastro de conta ou recuperação de senha — é deliberadamente mínimo para um app pessoal de uso único. Detalhes técnicos completos (por que senha em texto plano no `.env` é aceitável aqui, estratégia do token, requisitos de HTTPS do WebAuthn) em [`web-architecture.md`](./web-architecture.md); contrato dos endpoints em [`api.md`](./api.md).

## Fora do escopo desta fase (roadmap)

- **Notificações push** (Web Push via Service Worker): avisos de fatura fechando, lembrete de parcela vencendo. Documentado como próximo passo em [`web-architecture.md`](./web-architecture.md) — exige infraestrutura nova no backend (chaves VAPID, tabela de subscriptions, algum job/gatilho agendado) que não existe ainda.
- Uso offline para **criar/editar** dados: só leitura é suportada (últimos dados sincronizados continuam visíveis sem rede); mutações continuam exigindo conexão — ver [`web-architecture.md`](./web-architecture.md#uso-offline-leitura).
- Multiusuário (mantém-se fora de escopo, conforme `mvp-spec.md`).

## Critério de "pronto" para esta fase

- [x] App instalável no iPhone via Safari (manifest + ícones + meta tags iOS corretos).
- [x] Login por senha funcionando ponta a ponta contra o backend.
- [x] Registro e reautenticação via Face ID/Touch ID (WebAuthn) funcionando.
- [x] Navegação por abas + duas rotas modais espelhando as 6 telas do MVP.
- [x] Lógica de negócio real em Extrato, Cartões, Categorias, Nova transação e Nova compra parcelada.
- [x] Uso offline (leitura): últimos dados sincronizados continuam visíveis sem rede, com indicador de status de conexão.
