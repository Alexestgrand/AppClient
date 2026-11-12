import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface Period {
  from?: Date | undefined;
  to?: Date | undefined;
}

const periodWhere = ({ from, to }: Period): Prisma.SaleWhereInput =>
  from || to ? { saleDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

const sums = {
  revenueExclTax: true,
  vatCollected: true,
  totalCost: true,
  totalFees: true,
  profit: true,
  quantity: true,
} as const;

export const saleRepository = {
  list: (period: Period, take = 300) =>
    prisma.sale.findMany({
      where: periodWhere(period),
      include: {
        country: { select: { name: true, isoCode: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: { saleDate: 'desc' },
      take,
    }),
  create: (data: Prisma.SaleUncheckedCreateInput) => prisma.sale.create({ data }),
  delete: (id: string) => prisma.sale.delete({ where: { id } }),
  totals: (period: Period) =>
    prisma.sale.aggregate({ where: periodWhere(period), _sum: sums, _count: true }),
  byCountry: (period: Period) =>
    prisma.sale.groupBy({
      by: ['countryId'],
      where: periodWhere(period),
      _sum: sums,
      _count: true,
    }),
  byWarehouse: (period: Period) =>
    prisma.sale.groupBy({
      by: ['warehouseId'],
      where: periodWhere(period),
      _sum: sums,
      _count: true,
    }),
  byProduct: (period: Period) =>
    prisma.sale.groupBy({
      by: ['productName'],
      where: periodWhere(period),
      _sum: sums,
      orderBy: { _sum: { revenueExclTax: 'desc' } },
      take: 10,
    }),
  /** Agrégation mensuelle (SQL paramétré via Prisma, pas d'injection possible). */
  byMonth: (period: Period) =>
    prisma.$queryRaw<
      { month: Date; revenue: Prisma.Decimal; profit: Prisma.Decimal; vat: Prisma.Decimal }[]
    >`
      SELECT date_trunc('month', "saleDate") AS month,
             SUM("revenueExclTax") AS revenue, SUM("profit") AS profit, SUM("vatCollected") AS vat
      FROM "Sale"
      WHERE (${period.from ?? null}::timestamp IS NULL OR "saleDate" >= ${period.from ?? null}::timestamp)
        AND (${period.to ?? null}::timestamp IS NULL OR "saleDate" <= ${period.to ?? null}::timestamp)
      GROUP BY 1 ORDER BY 1`,
};
