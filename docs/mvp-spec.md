# Meu Dinheirinho

App pessoal de controle financeiro para registrar entradas, saídas, gastos de cartão de crédito e compras parceladas.

## Visão do produto

Um app simples e rápido pra registrar movimentações financeiras do dia a dia, usado como PWA instalada no iPhone (mesma experiência de um app nativo, sem passar pela App Store), com foco especial em resolver bem o problema de **cartão de crédito parcelado** — saber quanto fecha na fatura do mês e quanto ainda falta pagar de compras futuras.

Fora do escopo do MVP (planejado para versões futuras):
- Bot de WhatsApp/Telegram para registro por linguagem natural via Evolution API
- OCR de nota fiscal/comprovante
- Integração bancária via Open Finance
- Metas e previsões automáticas de gastos
- Multiusuário

## Escopo do MVP

### Funcionalidades core
- Registro de transações (entrada/saída): valor, categoria, descrição, data, conta
- Contas/carteiras: conta corrente, dinheiro, cartão de crédito
- Compras parceladas: valor total + número de parcelas → gera automaticamente os lançamentos futuros
- Categorias pré-definidas + customizáveis
- Dashboard: saldo do mês, gasto por categoria, fatura atual do cartão
- Extrato com filtro por mês/categoria/conta
- Tela de cartões: fatura atual, fatura futura (parcelas pendentes), limite disponível

### Modelagem de dados

```
Account (conta/carteira)
├── id, nome, tipo (conta_corrente | dinheiro | cartao_credito)
├── limite (se cartão)
└── dia_fechamento / dia_vencimento (se cartão)

Category (categoria)
├── id, nome, tipo (receita | despesa), icone/cor

Transaction (lançamento)
├── id, accountId, categoryId
├── valor, descricao, data
├── tipo (receita | despesa)
├── purchaseId (nullable — se veio de uma compra parcelada)
└── parcela_numero, parcela_total (nullable)

Purchase (compra parcelada)
├── id, accountId, categoryId
├── valor_total, descricao, data_compra
├── numero_parcelas
└── gera N Transactions automaticamente (uma por mês, já com data de vencimento calculada)
```

### Telas do MVP
1. Home/Dashboard
2. Nova transação
3. Nova compra parcelada
4. Extrato
5. Cartões
6. Categorias (CRUD simples)

## Stack de desenvolvimento

| Camada | Tecnologia |
|---|---|
| Web | Vite + React + TypeScript, PWA instalável no iPhone via Safari |
| Estilização | Tailwind CSS |
| Navegação | react-router-dom |
| Backend | Express + TypeScript |
| ORM | Prisma |
| Banco de dados | SQLite |
| Estado/cache no app | TanStack Query (React Query) |
| Deploy backend | Coolify (Hostinger VPS) |
| Deploy web | build estático, mesma infra Coolify/Hostinger VPS do backend |

### Observações técnicas
- Auth: implementada — senha single-user trocada por token, mais desbloqueio via Face ID/Touch ID (WebAuthn) nas reaberturas do app. Ver [`web-architecture.md`](./web-architecture.md) e a seção Auth de [`api.md`](./api.md).
- Backend escolhido como Express + TypeScript (mais simples que NestJS) por ser projeto pessoal de menor complexidade
- Reaproveita infraestrutura já existente: VPS Hostinger + Coolify
- O app foi planejado inicialmente como React Native/Expo; pivotou para Vite+React PWA porque a publicação na App Store estava travando o progresso — ver [`web-architecture.md`](./web-architecture.md) para o racional completo

## Roadmap pós-MVP (ideias para versões futuras)
- Integração com bot de WhatsApp via Evolution API (já disponível na VPS) para registro por linguagem natural e resumos
- Parsing de mensagens com LLM (ex: Claude Haiku) — custo estimado irrisório para uso pessoal
- OCR de comprovantes
- Integração bancária via Open Finance (Pluggy, Belvo)
- Metas por categoria e alertas
