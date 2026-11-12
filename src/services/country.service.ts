import type { z } from 'zod';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { countryRepository, exchangeRateRepository } from '@/repositories/country.repository';
import type { countrySchema, exchangeRateSchema } from '@/schemas/catalog';
import { settingsService } from './settings.service';

type CountryInput = z.infer<typeof countrySchema>;

function assertSingleStandardRate(input: CountryInput): void {
  if (input.vatRates.filter((rate) => rate.type === 'STANDARD').length > 1) {
    throw new AppError('Un pays ne peut avoir qu’un seul taux standard.');
  }
}

export const countryService = {
  list: (onlyActive = false) => countryRepository.list(onlyActive),
  async get(id: string) {
    const country = await countryRepository.findById(id);
    if (!country) throw new NotFoundError('Pays');
    return country;
  },
  create(input: CountryInput) {
    assertSingleStandardRate(input);
    return countryRepository.create(input);
  },
  async update(id: string, input: CountryInput) {
    assertSingleStandardRate(input);
    await countryService.get(id);
    return countryRepository.update(id, input);
  },
  async delete(id: string) {
    await countryService.get(id);
    const usage = await countryRepository.usage(id);
    if (usage.warehouses > 0 || usage.sales > 0) {
      throw new ConflictError(
        `Suppression impossible : pays utilisé par ${usage.warehouses} entrepôt(s) et ${usage.sales} vente(s). Désactivez-le plutôt.`,
      );
    }
    await countryRepository.delete(id);
  },
};

/** Taux de TVA standard d'un pays ; erreur explicite s'il n'est pas renseigné. */
export function standardVatRate(country: {
  name: string;
  vatRates: { type: string; rate: { toString(): string } }[];
}): string {
  const standard = country.vatRates.find((rate) => rate.type === 'STANDARD');
  if (!standard) {
    throw new AppError(
      `Aucun taux de TVA standard n'est renseigné pour ${country.name}. Complétez-le dans « Pays, TVA et devises ».`,
    );
  }
  return standard.rate.toString();
}

export const exchangeRateService = {
  list: () => exchangeRateRepository.list(),
  upsert: (input: z.infer<typeof exchangeRateSchema>) => exchangeRateRepository.upsert(input),
  update: (id: string, input: z.infer<typeof exchangeRateSchema>) =>
    exchangeRateRepository.update(id, input),
  delete: (id: string) => exchangeRateRepository.delete(id),
  /** Taux devise principale → devise de vente. 1 si identique ; erreur si non saisi. */
  async rateFor(currencyCode: string): Promise<string> {
    const { mainCurrency } = await settingsService.get();
    if (currencyCode === mainCurrency) return '1';
    const rate = await exchangeRateRepository.findByCurrency(currencyCode);
    if (!rate) {
      throw new AppError(
        `Aucun taux de change ${mainCurrency} → ${currencyCode} n'est renseigné (page « Pays, TVA et devises »).`,
      );
    }
    return rate.rate.toString();
  },
};
