# Meu Dinheirinho

App pessoal de controle financeiro para registrar entradas, saídas, gastos de cartão de crédito e compras parceladas.

## Visão do produto

Um app mobile simples e rápido pra registrar movimentações financeiras do dia a dia, com foco especial em resolver bem o problema de **cartão de crédito parcelado** — saber quanto fecha na fatura do mês e quanto ainda falta pagar de compras futuras.

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
| Mobile | React Native + Expo |
| Estilização | NativeWind (Tailwind no RN) |
| Navegação | Expo Router (file-based) |
| Backend | Express + TypeScript |
| ORM | Prisma |
| Banco de dados | PostgreSQL |
| Estado/cache no app | TanStack Query (React Query) |
| Deploy backend | Coolify (Hostinger VPS) |
| Deploy mobile | Expo (build + OTA updates) |

### Observações técnicas
- Auth: a definir — em app single-user pode-se simplificar com API key fixa no MVP; se houver plano de multiusuário no futuro, prever autenticação desde já (JWT simples via Express)
- Backend escolhido como Express + TypeScript (mais simples que NestJS) por ser projeto pessoal de menor complexidade
- Reaproveita infraestrutura já existente: VPS Hostinger + Coolify

## Roadmap pós-MVP (ideias para versões futuras)
- Integração com bot de WhatsApp via Evolution API (já disponível na VPS) para registro por linguagem natural e resumos
- Parsing de mensagens com LLM (ex: Claude Haiku) — custo estimado irrisório para uso pessoal
- OCR de comprovantes
- Integração bancária via Open Finance (Pluggy, Belvo)
- Metas por categoria e alertas
