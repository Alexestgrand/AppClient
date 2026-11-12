/**
 * Calculs de TVA.
 *   TTC = HT × (1 + taux / 100)
 *   HT  = TTC / (1 + taux / 100)
 *   TVA = TTC − HT
 * Le montant de TVA est déduit des montants arrondis, de sorte que HT + TVA = TTC
 * exactement (cohérence d'une facture).
 */
import { currencyDecimals, percentToRatio, roundMoney, toDec, type DecimalInput } from './money';

export type VatMode = 'HT_TO_TTC' | 'TTC_TO_HT';

export interface VatInput {
  amount: DecimalInput;
  ratePercent: DecimalInput;
  mode: VatMode;
  currency?: string;
}

export interface VatResult {
  priceExclTax: string;
  vatAmount: string;
  priceInclTax: string;
  ratePercent: string;
  currency: string;
}

export function assertValidRate(ratePercent: DecimalInput): void {
  const rate = toDec(ratePercent);
  if (rate.isNaN() || rate.isNegative() || rate.greaterThan(100)) {
    throw new RangeError('Le taux de TVA doit être compris entre 0 et 100 %.');
  }
}

export function computeVat({ amount, ratePercent, mode, currency = 'EUR' }: VatInput): VatResult {
  assertValidRate(ratePercent);
  const value = toDec(amount);
  if (value.isNaN() || value.isNegative()) throw new RangeError('Le montant doit être positif.');

  const coefficient = percentToRatio(ratePercent).plus(1);
  const ht =
    mode === 'HT_TO_TTC'
      ? roundMoney(value, currency)
      : roundMoney(value.div(coefficient), currency);
  const ttc =
    mode === 'HT_TO_TTC'
      ? roundMoney(value.times(coefficient), currency)
      : roundMoney(value, currency);
  const places = currencyDecimals(currency);

  return {
    priceExclTax: ht.toFixed(places),
    vatAmount: ttc.minus(ht).toFixed(places),
    priceInclTax: ttc.toFixed(places),
    ratePercent: toDec(ratePercent).toString(),
    currency,
  };
}
