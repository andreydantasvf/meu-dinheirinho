import { Prisma } from '../generated/prisma/client.js';

export type Installment = {
  valor: Prisma.Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
};

export function generateInstallments(input: {
  valorTotal: Prisma.Decimal | number | string;
  numeroParcelas: number;
  dataCompra: Date;
}): Installment[] {
  const valorTotal = new Prisma.Decimal(input.valorTotal);
  const totalCentavos = valorTotal
    .times(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);
  const centavosPorParcela = totalCentavos
    .dividedBy(input.numeroParcelas)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);

  const installments: Installment[] = [];
  let somaCentavos = new Prisma.Decimal(0);

  for (let i = 1; i <= input.numeroParcelas; i++) {
    const isUltima = i === input.numeroParcelas;
    const valorCentavos = isUltima
      ? totalCentavos.minus(somaCentavos)
      : centavosPorParcela;
    somaCentavos = somaCentavos.plus(valorCentavos);

    installments.push({
      valor: valorCentavos.dividedBy(100),
      data: addMonthsClamped(input.dataCompra, i - 1),
      parcelaNumero: i,
      parcelaTotal: input.numeroParcelas,
    });
  }

  return installments;
}

function addMonthsClamped(date: Date, months: number): Date {
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
