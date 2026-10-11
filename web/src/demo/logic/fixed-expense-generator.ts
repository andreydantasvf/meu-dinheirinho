import Decimal from 'decimal.js';

// Port de backend/src/services/fixed-expense-generator.ts. Mudou lá → espelhe aqui.

export function generateFixedExpenseTransactions(input: {
  valor: Decimal | number | string;
  dataInicio: Date;
  quantidadeMeses: number;
}): { valor: Decimal; data: Date }[] {
  const valor = new Decimal(input.valor);
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
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}
