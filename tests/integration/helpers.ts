import { prisma } from '@/lib/db';

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Vide toutes les tables de la base de TEST (refuse toute autre base). */
export async function resetDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error(
      'Sécurité : la base utilisée par les tests doit contenir « test » dans son nom.',
    );
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Sale", "CalculationHistory", "Product", "Warehouse", "Category", "VatRate", "Country", "ExchangeRate", "Session", "User", "AppSettings" CASCADE',
  );
}

export async function createCountry(iso = 'FR', currencyCode = 'EUR', rate = '20') {
  return prisma.country.create({
    data: {
      name: `Pays ${iso}`,
      isoCode: iso,
      currencyCode,
      vatRates: { create: [{ label: 'Standard', type: 'STANDARD', rate }] },
    },
  });
}
