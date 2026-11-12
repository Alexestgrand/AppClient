import { describe, expect, it } from 'vitest';
import { internationalCalculationSchema, vatCalculationSchema } from '@/schemas/calculation';
import { countrySchema, productSchema } from '@/schemas/catalog';
import { saleSchema } from '@/schemas/sale';

describe('validation Zod', () => {
  it('normalise les décimaux (virgule française) sans flottant', () => {
    expect(
      productSchema.parse({ name: 'A', reference: 'R', purchasePrice: '12,345' }).purchasePrice,
    ).toBe('12.345');
  });
  it('refuse les montants négatifs ou non numériques', () => {
    expect(
      productSchema.safeParse({ name: 'A', reference: 'R', purchasePrice: '-1' }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ name: 'A', reference: 'R', purchasePrice: 'abc' }).success,
    ).toBe(false);
    expect(productSchema.safeParse({ name: '', reference: 'R', purchasePrice: '1' }).success).toBe(
      false,
    );
  });
  it('borne le taux de TVA entre 0 et 100', () => {
    expect(
      vatCalculationSchema.safeParse({ amount: '10', ratePercent: '120', mode: 'HT_TO_TTC' })
        .success,
    ).toBe(false);
    expect(
      vatCalculationSchema.safeParse({ amount: '10', ratePercent: '20', mode: 'AUTRE' }).success,
    ).toBe(false);
  });
  it('valide les codes ISO pays et devise', () => {
    expect(
      countrySchema.safeParse({ name: 'X', isoCode: 'FRA', currencyCode: 'EUR' }).success,
    ).toBe(false);
    expect(
      countrySchema.safeParse({ name: 'X', isoCode: 'fr', currencyCode: 'euro' }).success,
    ).toBe(false);
    expect(countrySchema.parse({ name: 'X', isoCode: 'fr', currencyCode: 'eur' })).toMatchObject({
      isoCode: 'FR',
      currencyCode: 'EUR',
    });
  });
  it('valide les frais et objectifs', () => {
    const base = { costPrice: '20', target: { type: 'AMOUNT', value: '5' }, countryId: 'c1' };
    expect(
      internationalCalculationSchema.safeParse({
        ...base,
        fees: [{ type: 'PLATFORM', mode: 'PERCENT', base: 'HT', value: '150' }],
      }).success,
    ).toBe(false);
    expect(
      internationalCalculationSchema.safeParse({
        ...base,
        fees: [{ type: 'INCONNU', mode: 'FIXED', value: '1' }],
      }).success,
    ).toBe(false);
    expect(internationalCalculationSchema.parse(base).fees).toEqual([]);
  });
  it('exige une quantité entière positive pour une vente', () => {
    const base = { saleDate: '2026-01-01', productId: 'p', countryId: 'c', unitPriceExclTax: '10' };
    expect(saleSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
    expect(saleSchema.parse({ ...base, quantity: '3' }).quantity).toBe(3);
  });
});
