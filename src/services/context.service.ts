/** Données de référence chargées par les pages contenant des calculs. */
import { prisma } from '@/lib/db';
import { toJson } from '@/types/dto';
import type { CalculatorContext } from '@/types/client';
import { countryService, exchangeRateService } from './country.service';
import { settingsService } from './settings.service';

export async function loadCalculatorContext(): Promise<CalculatorContext> {
  const [countries, products, rates, settings] = await Promise.all([
    countryService.list(true),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        reference: true,
        purchasePrice: true,
        costPrice: true,
        warehouseId: true,
      },
      orderBy: { name: 'asc' },
    }),
    exchangeRateService.list(),
    settingsService.get(),
  ]);
  return {
    countries: toJson(
      countries.map(({ id, name, isoCode, currencyCode, vatRates }) => ({
        id,
        name,
        isoCode,
        currencyCode,
        vatRates: vatRates.map(({ id, label, type, rate }) => ({ id, label, type, rate })),
      })),
    ),
    products: toJson(products),
    exchangeRates: Object.fromEntries(
      rates.map((rate) => [rate.currencyCode, rate.rate.toString()]),
    ),
    mainCurrency: settings.mainCurrency,
    defaultTargetAmount: settings.defaultTargetAmount.toString(),
  };
}
