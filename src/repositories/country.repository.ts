import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const include = { vatRates: { orderBy: { rate: 'desc' } } } satisfies Prisma.CountryInclude;

export interface CountryData {
  name: string;
  isoCode: string;
  currencyCode: string;
  isActive: boolean;
  taxSource: string | null;
  taxSourceUrl: string | null;
  lastVerifiedAt: Date | null;
  vatRates: {
    label: string;
    type: 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';
    rate: string;
  }[];
}

export const countryRepository = {
  list: (onlyActive = false) =>
    prisma.country.findMany({
      where: onlyActive ? { isActive: true } : {},
      include,
      orderBy: { name: 'asc' },
    }),
  findById: (id: string) => prisma.country.findUnique({ where: { id }, include }),
  findManyByIds: (ids: string[]) =>
    prisma.country.findMany({ where: { id: { in: ids } }, include }),
  create: ({ vatRates, ...data }: CountryData) =>
    prisma.country.create({ data: { ...data, vatRates: { create: vatRates } }, include }),
  /** Remplace intégralement la liste des taux (transaction). */
  update: (id: string, { vatRates, ...data }: CountryData) =>
    prisma.$transaction(async (tx) => {
      await tx.vatRate.deleteMany({ where: { countryId: id } });
      return tx.country.update({
        where: { id },
        data: { ...data, vatRates: { create: vatRates } },
        include,
      });
    }),
  usage: async (id: string) => ({
    warehouses: await prisma.warehouse.count({ where: { countryId: id } }),
    sales: await prisma.sale.count({ where: { countryId: id } }),
  }),
  delete: (id: string) => prisma.country.delete({ where: { id } }),
};

export const exchangeRateRepository = {
  list: () => prisma.exchangeRate.findMany({ orderBy: { currencyCode: 'asc' } }),
  findByCurrency: (currencyCode: string) =>
    prisma.exchangeRate.findUnique({ where: { currencyCode } }),
  upsert: (data: { currencyCode: string; rate: string; source: string | null; rateDate: Date }) =>
    prisma.exchangeRate.upsert({
      where: { currencyCode: data.currencyCode },
      update: data,
      create: data,
    }),
  update: (
    id: string,
    data: { currencyCode: string; rate: string; source: string | null; rateDate: Date },
  ) => prisma.exchangeRate.update({ where: { id }, data }),
  delete: (id: string) => prisma.exchangeRate.delete({ where: { id } }),
};
