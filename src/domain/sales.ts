/**
 * Ventilation financière d'une vente (montants totaux en devise principale).
 * Mêmes définitions que pricing.ts : la TVA collectée n'entre jamais dans le bénéfice.
 */
import {
  D,
  moneyString,
  percentToRatio,
  roundMoney,
  toDec,
  type Dec,
  type DecimalInput,
} from './money';
import type { Fee } from './pricing';
import { assertValidRate } from './vat';

export interface SaleInput {
  quantity: number;
  /** Prix unitaire HT dans la devise de vente. */
  unitPriceExclTax: DecimalInput;
  vatRatePercent: DecimalInput;
  /** Unités de devise de vente pour 1 unité de devise principale. */
  exchangeRate: DecimalInput;
  /** Coût de revient unitaire en devise principale. */
  unitCost: DecimalInput;
  /** Frais par unité (fixes en devise principale, ou % du prix unitaire). */
  fees?: Fee[];
  saleCurrency: string;
  mainCurrency: string;
}

export interface SaleFinancials {
  revenueExclTax: string;
  vatCollected: string;
  totalCost: string;
  totalFees: string;
  profit: string;
}

export function computeSaleFinancials(input: SaleInput): SaleFinancials {
  assertValidRate(input.vatRatePercent);
  const rate = toDec(input.exchangeRate);
  if (!rate.greaterThan(0))
    throw new RangeError('Le taux de change doit être strictement positif.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new RangeError('La quantité doit être un entier ≥ 1.');
  }
  const qty = new D(input.quantity);
  const unitHtSale = roundMoney(input.unitPriceExclTax, input.saleCurrency);
  const unitVatSale = roundMoney(
    unitHtSale.times(percentToRatio(input.vatRatePercent)),
    input.saleCurrency,
  );

  const unitHtMain = unitHtSale.div(rate);
  const unitTtcMain = unitHtSale.plus(unitVatSale).div(rate);
  const unitFees = (input.fees ?? []).reduce<Dec>((acc, fee) => {
    if (fee.mode === 'FIXED') return acc.plus(toDec(fee.value));
    const base = fee.base === 'HT' ? unitHtMain : unitTtcMain;
    return acc.plus(base.times(percentToRatio(fee.value)));
  }, new D(0));

  const revenue = unitHtMain.times(qty);
  const cost = toDec(input.unitCost).times(qty);
  const fees = unitFees.times(qty);
  const m = (value: Dec) => moneyString(value, input.mainCurrency);
  return {
    revenueExclTax: m(revenue),
    vatCollected: m(unitVatSale.times(qty).div(rate)),
    totalCost: m(cost),
    totalFees: m(fees),
    profit: m(revenue.minus(cost).minus(fees)),
  };
}
