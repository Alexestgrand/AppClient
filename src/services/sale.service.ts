import type { z } from 'zod';
import { computeSaleFinancials } from '@/domain/sales';
import { NotFoundError } from '@/lib/errors';
import { saleRepository, type Period } from '@/repositories/sale.repository';
import type { saleSchema } from '@/schemas/sale';
import { productService, productUnitCost } from './catalog.service';
import { countryService, exchangeRateService, standardVatRate } from './country.service';
import { settingsService } from './settings.service';

export const saleService = {
  list: (period: Period) => saleRepository.list(period),

  /** Enregistre une vente en figeant coût, taux de change et ventilation financière. */
  async create(input: z.infer<typeof saleSchema>) {
    const [product, country, settings] = await Promise.all([
      productService.get(input.productId),
      countryService.get(input.countryId),
      settingsService.get(),
    ]);
    const vatRatePercent = input.vatRatePercent ?? standardVatRate(country);
    const exchangeRate = await exchangeRateService.rateFor(country.currencyCode);
    const financials = computeSaleFinancials({
      quantity: input.quantity,
      unitPriceExclTax: input.unitPriceExclTax,
      vatRatePercent,
      exchangeRate,
      unitCost: productUnitCost(product),
      fees: input.fees,
      saleCurrency: country.currencyCode,
      mainCurrency: settings.mainCurrency,
    });
    return saleRepository.create({
      saleDate: input.saleDate,
      productId: product.id,
      productName: product.name,
      countryId: country.id,
      warehouseId: input.warehouseId ?? product.warehouseId,
      quantity: input.quantity,
      currency: country.currencyCode,
      exchangeRate,
      unitPriceExclTax: input.unitPriceExclTax,
      vatRate: vatRatePercent,
      note: input.note,
      ...financials,
    });
  },

  async delete(id: string) {
    try {
      await saleRepository.delete(id);
    } catch {
      throw new NotFoundError('Vente');
    }
  },
};
