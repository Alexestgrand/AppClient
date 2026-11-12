import { describe, expect, it } from 'vitest';
import { compareCountries, computeTargetPrice } from '@/domain/pricing';

describe('computeTargetPrice', () => {
  it("reproduit l'exemple du cahier des charges (coût 20, objectif 5, TVA 20 %)", () => {
    const r = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 20,
    });
    expect(r.sale).toEqual({
      currency: 'EUR',
      priceExclTax: '25.00',
      vatAmount: '5.00',
      priceInclTax: '30.00',
    });
    expect(r.breakdown.revenueExclTax).toBe('25.00');
    expect(r.breakdown.grossMargin).toBe('5.00');
    expect(r.breakdown.profit).toBe('5.00');
    expect(r.breakdown.vatCollected).toBe('5.00');
  });

  it('ne compte jamais la TVA dans le bénéfice', () => {
    const low = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 0,
    });
    const high = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 27,
    });
    expect(low.breakdown.profit).toBe(high.breakdown.profit);
    expect(high.sale.priceExclTax).toBe('25.00');
    expect(high.sale.priceInclTax).toBe('31.75');
  });

  it('intègre les frais fixes et en pourcentage du HT', () => {
    const r = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 20,
      fees: [
        { type: 'TRANSPORT', mode: 'FIXED', value: 3 },
        { type: 'PLATFORM', mode: 'PERCENT', base: 'HT', value: 10 },
      ],
    });
    // HT = (20 + 3 + 5) / 0,9 = 31,111… → arrondi supérieur 31,12
    expect(r.sale.priceExclTax).toBe('31.12');
    expect(r.breakdown.totalFees).toBe('6.11');
    expect(Number(r.breakdown.profit)).toBeGreaterThanOrEqual(5);
  });

  it('gère des frais en pourcentage du TTC', () => {
    const r = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 20,
      fees: [{ type: 'PAYMENT', mode: 'PERCENT', base: 'TTC', value: 2.5 }],
    });
    // HT = 25 / (1 − 0,025 × 1,2) = 25 / 0,97 = 25,773… → 25,78
    expect(r.sale.priceExclTax).toBe('25.78');
    expect(r.breakdown.profit).toBe('5.01');
  });

  it("gère l'objectif en % du coût et en taux de marque", () => {
    expect(
      computeTargetPrice({
        costPrice: 20,
        target: { type: 'MARKUP_PERCENT', value: 25 },
        vatRatePercent: 20,
      }).sale.priceExclTax,
    ).toBe('25.00');
    const r = computeTargetPrice({
      costPrice: 20,
      target: { type: 'MARGIN_RATE_PERCENT', value: 20 },
      vatRatePercent: 20,
    });
    expect(r.sale.priceExclTax).toBe('25.00');
    expect(r.breakdown.profit).toBe('5.00');
  });

  it('convertit dans la devise de vente', () => {
    const r = computeTargetPrice({
      costPrice: 20,
      target: { type: 'AMOUNT', value: 5 },
      vatRatePercent: 8.1,
      saleCurrency: 'CHF',
      exchangeRate: '0.94',
    });
    expect(r.sale).toEqual({
      currency: 'CHF',
      priceExclTax: '23.50',
      vatAmount: '1.90',
      priceInclTax: '25.40',
    });
    expect(r.breakdown.currency).toBe('EUR');
    expect(r.breakdown.profit).toBe('5.00');
  });

  it('signale un objectif inatteignable', () => {
    expect(() =>
      computeTargetPrice({
        costPrice: 20,
        target: { type: 'MARGIN_RATE_PERCENT', value: 60 },
        vatRatePercent: 20,
        fees: [{ type: 'PLATFORM', mode: 'PERCENT', base: 'HT', value: 40 }],
      }),
    ).toThrow(/inatteignable/);
  });
});

describe('compareCountries', () => {
  it('compare plusieurs pays et isole les erreurs', () => {
    const rows = compareCountries({ costPrice: 20, target: { type: 'AMOUNT', value: 5 } }, [
      {
        countryId: '1',
        countryName: 'A',
        isoCode: 'AA',
        currency: 'EUR',
        vatRatePercent: 20,
        exchangeRate: 1,
      },
      {
        countryId: '2',
        countryName: 'B',
        isoCode: 'BB',
        currency: 'EUR',
        vatRatePercent: 10,
        exchangeRate: 1,
      },
      {
        countryId: '3',
        countryName: 'C',
        isoCode: 'CC',
        currency: 'XXX',
        vatRatePercent: 10,
        exchangeRate: 0,
      },
    ]);
    expect(rows.map((r) => (r.ok ? r.result.sale.priceInclTax : 'erreur'))).toEqual([
      '30.00',
      '27.50',
      'erreur',
    ]);
  });
});

import { computeSaleFinancials } from '@/domain/sales';
describe('computeSaleFinancials', () => {
  it('ventile une vente en distinguant CA, TVA, coût, frais et bénéfice', () => {
    const r = computeSaleFinancials({
      quantity: 3,
      unitPriceExclTax: '25',
      vatRatePercent: '20',
      exchangeRate: 1,
      unitCost: '20',
      fees: [{ type: 'PAYMENT', mode: 'PERCENT', base: 'TTC', value: 2 }],
      saleCurrency: 'EUR',
      mainCurrency: 'EUR',
    });
    expect(r).toEqual({
      revenueExclTax: '75.00',
      vatCollected: '15.00',
      totalCost: '60.00',
      totalFees: '1.80',
      profit: '13.20',
    });
  });
  it('convertit une vente en devise étrangère', () => {
    const r = computeSaleFinancials({
      quantity: 2,
      unitPriceExclTax: '47',
      vatRatePercent: '0',
      exchangeRate: '0.94',
      unitCost: '30',
      saleCurrency: 'CHF',
      mainCurrency: 'EUR',
    });
    expect(r.revenueExclTax).toBe('100.00');
    expect(r.profit).toBe('40.00');
  });
});
