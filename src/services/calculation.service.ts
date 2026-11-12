/** Orchestration des calculs : récupère les données fiscales en base et appelle le domaine. */
import type { z } from 'zod';
import {
  compareCountries,
  computeTargetPrice,
  type CountryComparisonRow,
  type PricingResult,
} from '@/domain/pricing';
import { computeVat, type VatResult } from '@/domain/vat';
import { NotFoundError } from '@/lib/errors';
import { historyRepository, type HistoryFilter } from '@/repositories/history.repository';
import type {
  comparisonSchema,
  internationalCalculationSchema,
  vatCalculationSchema,
} from '@/schemas/calculation';
import { countryService, exchangeRateService, standardVatRate } from './country.service';
import { settingsService } from './settings.service';

type VatInput = z.infer<typeof vatCalculationSchema>;
type InternationalInput = z.infer<typeof internationalCalculationSchema>;
type ComparisonInput = z.infer<typeof comparisonSchema>;

export const calculationService = {
  async vat(input: VatInput): Promise<VatResult> {
    const country = input.countryId ? await countryService.get(input.countryId) : null;
    return computeVat({
      amount: input.amount,
      ratePercent: input.ratePercent,
      mode: input.mode,
      currency: country?.currencyCode ?? (await settingsService.get()).mainCurrency,
    });
  },

  async international(input: InternationalInput): Promise<PricingResult> {
    const [country, settings] = await Promise.all([
      countryService.get(input.countryId),
      settingsService.get(),
    ]);
    return computeTargetPrice({
      costPrice: input.costPrice,
      target: input.target,
      fees: input.fees,
      vatRatePercent: input.vatRatePercent ?? standardVatRate(country),
      mainCurrency: settings.mainCurrency,
      saleCurrency: country.currencyCode,
      exchangeRate: await exchangeRateService.rateFor(country.currencyCode),
    });
  },

  async compare(input: ComparisonInput): Promise<CountryComparisonRow[]> {
    const settings = await settingsService.get();
    const countries = await countryService.list(true);
    const selected = countries.filter((country) => input.countryIds.includes(country.id));
    const contexts = await Promise.all(
      selected.map(async (country) => {
        let vatRatePercent = '-1';
        let exchangeRate = '0';
        try {
          vatRatePercent = standardVatRate(country);
          exchangeRate = await exchangeRateService.rateFor(country.currencyCode);
        } catch {
          // Données manquantes : la ligne sera signalée en erreur par le domaine.
        }
        return {
          countryId: country.id,
          countryName: country.name,
          isoCode: country.isoCode,
          currency: country.currencyCode,
          vatRatePercent,
          exchangeRate,
        };
      }),
    );
    return compareCountries(
      {
        costPrice: input.costPrice,
        target: input.target,
        fees: input.fees,
        mainCurrency: settings.mainCurrency,
      },
      contexts,
    );
  },

  async saveVat(input: VatInput) {
    const result = await calculationService.vat(input);
    const country = input.countryId ? await countryService.get(input.countryId) : null;
    return historyRepository.create({
      type: 'VAT',
      productId: input.productId,
      countryId: country?.id ?? null,
      countryName: country?.name ?? null,
      currency: result.currency,
      initialPrice: input.amount,
      vatRate: input.ratePercent,
      priceExclTax: result.priceExclTax,
      vatAmount: result.vatAmount,
      priceInclTax: result.priceInclTax,
      label: input.label,
      details: { input: { ...input }, result: { ...result } },
    });
  },

  async saveInternational(input: InternationalInput) {
    const result = await calculationService.international(input);
    const country = await countryService.get(input.countryId);
    return historyRepository.create({
      type: 'INTERNATIONAL',
      productId: input.productId,
      countryId: country.id,
      countryName: country.name,
      currency: result.sale.currency,
      initialPrice: input.costPrice,
      vatRate: result.vatRatePercent,
      priceExclTax: result.sale.priceExclTax,
      vatAmount: result.sale.vatAmount,
      priceInclTax: result.sale.priceInclTax,
      targetAmount: result.breakdown.targetProfit,
      profit: result.breakdown.profit,
      label: input.label,
      details: JSON.parse(JSON.stringify({ input, result })),
    });
  },
};

export const historyService = {
  list: (filter: HistoryFilter) => historyRepository.list(filter),
  async get(id: string) {
    const entry = await historyRepository.findById(id);
    if (!entry) throw new NotFoundError('Calcul');
    return entry;
  },
  async delete(id: string) {
    await historyService.get(id);
    await historyRepository.delete(id);
  },
  recent: (take = 5) => historyRepository.list({}, take),
};
