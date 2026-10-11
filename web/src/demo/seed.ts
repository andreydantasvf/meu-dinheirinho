import type { Account, Category } from '@/types/entities';
import { createFixedExpense } from './handlers/fixed-expenses';
import { createPurchase } from './handlers/purchases';
import { createReminder } from './handlers/reminders';
import { createTransaction } from './handlers/transactions';
import type { DemoDb } from './types';

// Bump ao mudar o formato do DemoDb ou o seed: bancos salvos com outra versão são descartados.
export const DEMO_DB_VERSION = 1;

// Ids fixos para contas/categorias: as cores dos cartões ficam fora da API (localStorage,
// lib/card-colors.ts) e precisam de um id estável para sobreviver ao reset.
const ACC = {
  principal: 'seed-conta-principal',
  carteira: 'seed-carteira',
  roxinho: 'seed-cartao-roxinho',
  laranjinha: 'seed-cartao-laranjinha',
} as const;

const CAT = {
  mercado: 'seed-cat-mercado',
  restaurantes: 'seed-cat-restaurantes',
  transporte: 'seed-cat-transporte',
  moradia: 'seed-cat-moradia',
  lazer: 'seed-cat-lazer',
  saude: 'seed-cat-saude',
  assinaturas: 'seed-cat-assinaturas',
  educacao: 'seed-cat-educacao',
  compras: 'seed-cat-compras',
  outros: 'seed-cat-outros',
  salario: 'seed-cat-salario',
  freela: 'seed-cat-freela',
} as const;

export const SEED_CARD_COLORS: Record<string, string> = {
  [ACC.roxinho]: 'roxo',
  [ACC.laranjinha]: 'laranja',
};

type ExpenseTemplate = {
  categoryId: string;
  accountId: string;
  descricoes: string[];
  min: number;
  max: number;
  vezesPorMes: number;
};

// ~24 despesas avulsas por mês. Restaurantes: 6 × no mínimo R$ 55 > meta de R$ 300, então a
// meta aparece estourada em todo mês do histórico.
const DESPESAS: ExpenseTemplate[] = [
  {
    categoryId: CAT.mercado,
    accountId: ACC.roxinho,
    descricoes: ['Supermercado', 'Hortifruti', 'Atacadão', 'Feira'],
    min: 150,
    max: 280,
    vezesPorMes: 4,
  },
  {
    categoryId: CAT.restaurantes,
    accountId: ACC.roxinho,
    descricoes: [
      'iFood',
      'Restaurante japonês',
      'Pizzaria',
      'Almoço do trabalho',
      'Hamburgueria',
      'Padaria',
    ],
    min: 55,
    max: 110,
    vezesPorMes: 6,
  },
  {
    categoryId: CAT.transporte,
    accountId: ACC.laranjinha,
    descricoes: ['Uber', '99', 'Combustível', 'Estacionamento'],
    min: 18,
    max: 60,
    vezesPorMes: 5,
  },
  {
    categoryId: CAT.lazer,
    accountId: ACC.laranjinha,
    descricoes: ['Cinema', 'Show', 'Bar com amigos'],
    min: 40,
    max: 180,
    vezesPorMes: 3,
  },
  {
    categoryId: CAT.saude,
    accountId: ACC.principal,
    descricoes: ['Farmácia', 'Consulta'],
    min: 30,
    max: 150,
    vezesPorMes: 2,
  },
  {
    categoryId: CAT.compras,
    accountId: ACC.roxinho,
    descricoes: ['Roupas', 'Presente', 'Livraria'],
    min: 60,
    max: 250,
    vezesPorMes: 2,
  },
  {
    categoryId: CAT.outros,
    accountId: ACC.carteira,
    descricoes: ['Café', 'Pastel na feira', 'Gorjeta'],
    min: 10,
    max: 50,
    vezesPorMes: 2,
  },
];

// mulberry32: PRNG determinístico — todo visitante (e todo reset) vê os mesmos valores.
function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// month pode sair de 0-11 (Date.UTC normaliza: -1 = dezembro do ano anterior); o dia é
// limitado ao último dia do mês.
function isoDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString();
}

export function createSeed(hoje: Date): DemoDb {
  const rng = createRng(20261011);
  const now = hoje.toISOString();
  const y = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  const db: DemoDb = {
    version: DEMO_DB_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    purchases: [],
    fixedExpenses: [],
    reminders: [],
  };

  const account = (
    id: string,
    nome: string,
    tipo: Account['tipo'],
    card?: { limite: string; diaFechamento: number; diaVencimento: number },
  ): Account => ({
    id,
    nome,
    tipo,
    limite: card?.limite ?? null,
    diaFechamento: card?.diaFechamento ?? null,
    diaVencimento: card?.diaVencimento ?? null,
    createdAt: now,
    updatedAt: now,
  });
  db.accounts.push(
    account(ACC.principal, 'Conta principal', 'CONTA_CORRENTE'),
    account(ACC.carteira, 'Carteira', 'DINHEIRO'),
    account(ACC.roxinho, 'Cartão Roxinho', 'CARTAO_CREDITO', {
      limite: '8000',
      diaFechamento: 3,
      diaVencimento: 10,
    }),
    account(ACC.laranjinha, 'Cartão Laranjinha', 'CARTAO_CREDITO', {
      limite: '4000',
      diaFechamento: 20,
      diaVencimento: 27,
    }),
  );

  // icone null → CategoryIcon escolhe o ícone pelo nome; emoji/chave só onde o nome não casa.
  const category = (
    id: string,
    nome: string,
    tipo: Category['tipo'],
    cor: string,
    extra: { icone?: string; metaMensal?: string } = {},
  ): Category => ({
    id,
    nome,
    tipo,
    cor,
    icone: extra.icone ?? null,
    metaMensal: extra.metaMensal ?? null,
  });
  db.categories.push(
    category(CAT.mercado, 'Mercado', 'DESPESA', '#22c55e', {
      metaMensal: '1200',
    }),
    category(CAT.restaurantes, 'Restaurantes', 'DESPESA', '#f97316', {
      metaMensal: '300',
    }),
    category(CAT.transporte, 'Transporte', 'DESPESA', '#3b82f6', {
      metaMensal: '400',
    }),
    category(CAT.moradia, 'Moradia', 'DESPESA', '#a855f7'),
    category(CAT.lazer, 'Lazer', 'DESPESA', '#ec4899'),
    category(CAT.saude, 'Saúde', 'DESPESA', '#ef4444'),
    category(CAT.assinaturas, 'Assinaturas', 'DESPESA', '#eab308'),
    category(CAT.educacao, 'Educação', 'DESPESA', '#14b8a6', { icone: '📚' }),
    category(CAT.compras, 'Compras', 'DESPESA', '#6366f1'),
    category(CAT.outros, 'Outros', 'DESPESA', '#64748b'),
    category(CAT.salario, 'Salário', 'RECEITA', '#10b981'),
    category(CAT.freela, 'Freela', 'RECEITA', '#0ea5e9', { icone: 'trabalho' }),
  );

  // Receitas: salário do histórico até o próximo mês; freela em meses alternados.
  for (let offset = -2; offset <= 1; offset++) {
    createTransaction(db, {
      accountId: ACC.principal,
      categoryId: CAT.salario,
      valor: '6500',
      descricao: 'Salário',
      data: isoDate(y, m + offset, 5),
      tipo: 'RECEITA',
    });
  }
  for (const offset of [-2, 0]) {
    createTransaction(db, {
      accountId: ACC.principal,
      categoryId: CAT.freela,
      valor: '1200',
      descricao: 'Freela — site institucional',
      data: isoDate(y, m + offset, 20),
      tipo: 'RECEITA',
    });
  }

  // Despesas avulsas nos 2 meses passados e no atual (o mês inteiro — dias à frente de hoje
  // aparecem como lançamentos agendados, garantindo movimento mesmo no dia 1º).
  const valor = (min: number, max: number) =>
    (Math.round((min + rng() * (max - min)) * 100) / 100).toFixed(2);
  for (let offset = -2; offset <= 0; offset++) {
    for (const tpl of DESPESAS) {
      for (let i = 0; i < tpl.vezesPorMes; i++) {
        createTransaction(db, {
          accountId: tpl.accountId,
          categoryId: tpl.categoryId,
          valor: valor(tpl.min, tpl.max),
          descricao: tpl.descricoes[Math.floor(rng() * tpl.descricoes.length)],
          data: isoDate(y, m + offset, 1 + Math.floor(rng() * 28)),
          tipo: 'DESPESA',
        });
      }
    }
  }

  // Compras parceladas em estágios diferentes: começando agora, no meio e na última parcela.
  createPurchase(db, {
    accountId: ACC.roxinho,
    categoryId: CAT.compras,
    valorTotal: '4800',
    descricao: 'Notebook',
    dataCompra: isoDate(y, m, 8),
    numeroParcelas: 10,
  });
  createPurchase(db, {
    accountId: ACC.laranjinha,
    categoryId: CAT.compras,
    valorTotal: '3600',
    descricao: 'Geladeira',
    dataCompra: isoDate(y, m - 5, 15),
    numeroParcelas: 12,
  });
  createPurchase(db, {
    accountId: ACC.roxinho,
    categoryId: CAT.educacao,
    valorTotal: '1800',
    descricao: 'Curso de inglês',
    dataCompra: isoDate(y, m - 5, 12),
    numeroParcelas: 6,
  });

  // Gastos fixos (geram 12 meses a partir do início, como no backend).
  const aluguel = createFixedExpense(db, {
    accountId: ACC.principal,
    categoryId: CAT.moradia,
    valor: '1800',
    descricao: 'Aluguel',
    dataInicio: isoDate(y, m - 2, 10),
  });
  createFixedExpense(db, {
    accountId: ACC.principal,
    categoryId: CAT.saude,
    valor: '119.90',
    descricao: 'Academia',
    dataInicio: isoDate(y, m - 2, 7),
  });
  createFixedExpense(db, {
    accountId: ACC.roxinho,
    categoryId: CAT.assinaturas,
    valor: '55.90',
    descricao: 'Streaming de vídeo',
    dataInicio: isoDate(y, m - 2, 15),
  });
  createFixedExpense(db, {
    accountId: ACC.laranjinha,
    categoryId: CAT.assinaturas,
    valor: '21.90',
    descricao: 'Streaming de música',
    dataInicio: isoDate(y, m - 2, 22),
  });

  // Lembretes: um ligado a gasto fixo, um mensal de entrada, um único no futuro.
  const daqui40Dias = new Date(Date.UTC(y, m, hoje.getUTCDate() + 40))
    .toISOString()
    .slice(0, 10);
  createReminder(
    db,
    {
      titulo: 'Pagar aluguel',
      tipo: 'SAIDA',
      valor: '1800',
      recorrencia: 'MENSAL',
      diaDoMes: 10,
      horario: '09:00',
      diasAntecedencia: 2,
      fixedExpenseId: aluguel.id,
    },
    hoje,
  );
  createReminder(
    db,
    {
      titulo: 'Receber salário',
      tipo: 'ENTRADA',
      valor: '6500',
      recorrencia: 'MENSAL',
      diaDoMes: 5,
      horario: '08:00',
    },
    hoje,
  );
  createReminder(
    db,
    {
      titulo: 'Pagar IPVA',
      tipo: 'SAIDA',
      valor: '1450.30',
      recorrencia: 'UNICO',
      dataUnica: daqui40Dias,
      horario: '10:00',
      diasAntecedencia: 3,
    },
    hoje,
  );

  return db;
}
