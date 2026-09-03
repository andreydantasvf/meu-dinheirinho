import { Prisma } from '../generated/prisma/client.js';

export function generateFixedExpenseTransactions(input: {
  valor: Prisma.Decimal | number | string;
  dataInicio: Date;
  quantidadeMeses: number;
}): { valor: Prisma.Decimal; data: Date }[] {
  const valor = new Prisma.Decimal(input.valor);
  const transactions = [];

  for (let i = 0; i < input.quantidadeMeses; i++) {
    transactions.push({
      valor: valor,
      data: addMonthsClamped(input.dataInicio, i),
    });
  }
  return transactions;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}
