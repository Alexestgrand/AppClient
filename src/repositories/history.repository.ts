import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface HistoryFilter {
  search?: string | undefined;
  type?: 'VAT' | 'INTERNATIONAL' | undefined;
  countryId?: string | undefined;
}

export const historyRepository = {
  list: ({ search, type, countryId }: HistoryFilter, take = 200) =>
    prisma.calculationHistory.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(countryId ? { countryId } : {}),
        ...(search
          ? {
              OR: [
                { label: { contains: search, mode: 'insensitive' } },
                { countryName: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { product: { select: { id: true, name: true, reference: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
  findById: (id: string) =>
    prisma.calculationHistory.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, reference: true } } },
    }),
  create: (data: Prisma.CalculationHistoryUncheckedCreateInput) =>
    prisma.calculationHistory.create({ data }),
  delete: (id: string) => prisma.calculationHistory.delete({ where: { id } }),
};
