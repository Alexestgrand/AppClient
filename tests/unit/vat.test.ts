import { describe, expect, it } from 'vitest';
import { computeVat } from '@/domain/vat';
import { moneyString, roundMoney } from '@/domain/money';

describe('computeVat', () => {
  it('calcule HT → TTC', () => {
    expect(computeVat({ amount: '100', ratePercent: '20', mode: 'HT_TO_TTC' })).toEqual({
      priceExclTax: '100.00',
      vatAmount: '20.00',
      priceInclTax: '120.00',
      ratePercent: '20',
      currency: 'EUR',
    });
  });

  it('calcule TTC → HT', () => {
    const result = computeVat({ amount: '120', ratePercent: '20', mode: 'TTC_TO_HT' });
    expect(result.priceExclTax).toBe('100.00');
    expect(result.vatAmount).toBe('20.00');
  });

  it('garantit HT + TVA = TTC malgré les arrondis', () => {
    const result = computeVat({ amount: '10', ratePercent: '5.5', mode: 'TTC_TO_HT' });
    expect(result.priceExclTax).toBe('9.48');
    expect(result.vatAmount).toBe('0.52');
    expect(Number(result.priceExclTax) * 100 + Number(result.vatAmount) * 100).toBe(1000);
  });

  it('évite les erreurs de flottants (0,1 + 0,2)', () => {
    const result = computeVat({ amount: 0.1 + 0.2, ratePercent: 0, mode: 'HT_TO_TTC' });
    expect(result.priceInclTax).toBe('0.30');
  });

  it('respecte les devises sans décimales', () => {
    expect(
      computeVat({ amount: '1000', ratePercent: '10', mode: 'HT_TO_TTC', currency: 'JPY' })
        .priceInclTax,
    ).toBe('1100');
  });

  it('gère un taux à 0 %', () => {
    expect(computeVat({ amount: '50', ratePercent: '0', mode: 'HT_TO_TTC' }).vatAmount).toBe(
      '0.00',
    );
  });

  it('refuse un taux ou un montant invalide', () => {
    expect(() => computeVat({ amount: '10', ratePercent: '-1', mode: 'HT_TO_TTC' })).toThrow();
    expect(() => computeVat({ amount: '10', ratePercent: '101', mode: 'HT_TO_TTC' })).toThrow();
    expect(() => computeVat({ amount: '-10', ratePercent: '20', mode: 'HT_TO_TTC' })).toThrow();
  });
});

describe('arrondis monétaires', () => {
  it('arrondit au demi supérieur', () => {
    expect(moneyString('2.345')).toBe('2.35');
    expect(moneyString('2.344')).toBe('2.34');
    expect(roundMoney('-2.345').toFixed(2)).toBe('-2.35');
  });
  it('est déterministe', () => {
    const runs = Array.from({ length: 5 }, () =>
      computeVat({ amount: '19.99', ratePercent: '21', mode: 'HT_TO_TTC' }),
    );
    expect(new Set(runs.map((r) => JSON.stringify(r))).size).toBe(1);
  });
});
