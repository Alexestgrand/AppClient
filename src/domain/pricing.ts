/**
 * Calcul du prix de vente cible permettant d'atteindre un objectif financier.
 *
 * Définitions (par unité vendue, en devise principale) :
 *   - Chiffre d'affaires (CA HT) = prix de vente HT
 *   - TVA collectée            = dette envers l'État, JAMAIS comptée dans la marge ni le bénéfice
 *   - Marge brute              = CA HT − coût de revient
 *   - Bénéfice                 = marge brute − frais variables
 *
 * L'objectif porte sur le BÉNÉFICE (après frais variables).
 *
 * Avec F = frais fixes, pHT = Σ frais % du HT, pTTC = Σ frais % du TTC, t = taux de TVA :
 *   frais(HT) = F + HT·pHT + HT·(1+t)·pTTC
 *   - objectif en montant A       : HT = (coût + F + A) / (1 − pHT − pTTC·(1+t))
 *   - objectif en % du coût m     : idem avec A = coût × m
 *   - objectif en taux de marque r: HT = (coût + F) / (1 − pHT − pTTC·(1+t) − r)
 *
 * Règle d'arrondi : le prix HT cible est arrondi à l'unité monétaire SUPÉRIEURE (centime),
 * pour garantir que l'objectif est atteint ; la TVA est ensuite arrondie au plus proche.
 */
import {
  currencyDecimals,
  D,
  moneyString,
  percentToRatio,
  roundMoney,
  toDec,
  type Dec,
  type DecimalInput,
} from './money';
import { assertValidRate } from './vat';

export const FEE_TYPES = ['TRANSPORT', 'CUSTOMS', 'PLATFORM', 'PAYMENT', 'OTHER'] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  TRANSPORT: 'Transport',
  CUSTOMS: 'Douane',
  PLATFORM: 'Plateforme',
  PAYMENT: 'Paiement',
  OTHER: 'Autre',
};

export type Fee =
  | { type: FeeType; label?: string | null; mode: 'FIXED'; value: DecimalInput }
  | {
      type: FeeType;
      label?: string | null;
      mode: 'PERCENT';
      base: 'HT' | 'TTC';
      value: DecimalInput;
    };

export type TargetType = 'AMOUNT' | 'MARKUP_PERCENT' | 'MARGIN_RATE_PERCENT';

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  AMOUNT: 'Montant fixe par produit',
  MARKUP_PERCENT: '% du coût de revient',
  MARGIN_RATE_PERCENT: '% du prix de vente HT (taux de marque)',
};

export interface PricingInput {
  /** Coût de revient unitaire, en devise principale. */
  costPrice: DecimalInput;
  target: { type: TargetType; value: DecimalInput };
  vatRatePercent: DecimalInput;
  fees?: Fee[];
  /** Devise principale (celle du coût, de l'objectif et des frais fixes). */
  mainCurrency?: string;
  /** Devise de vente du pays de destination. */
  saleCurrency?: string;
  /** Nombre d'unités de devise de vente pour 1 unité de devise principale. */
  exchangeRate?: DecimalInput;
}

export interface FeeLine {
  type: FeeType;
  label: string;
  amount: string;
}

export interface PricingResult {
  /** Prix affichés dans la devise de vente. */
  sale: {
    currency: string;
    priceExclTax: string;
    vatAmount: string;
    priceInclTax: string;
  };
  vatRatePercent: string;
  exchangeRate: string;
  /** Analyse financière dans la devise principale. */
  breakdown: {
    currency: string;
    revenueExclTax: string;
    vatCollected: string;
    costPrice: string;
    grossMargin: string;
    fees: FeeLine[];
    totalFees: string;
    profit: string;
    targetProfit: string;
  };
}

export class PricingError extends Error {}

function sumFees(fees: Fee[], predicate: (fee: Fee) => boolean): Dec {
  return fees.filter(predicate).reduce((acc, fee) => acc.plus(toDec(fee.value)), new D(0));
}

function feeAmount(fee: Fee, ht: Dec, ttc: Dec): Dec {
  if (fee.mode === 'FIXED') return toDec(fee.value);
  return (fee.base === 'HT' ? ht : ttc).times(percentToRatio(fee.value));
}

export function computeTargetPrice(input: PricingInput): PricingResult {
  const mainCurrency = input.mainCurrency ?? 'EUR';
  const saleCurrency = input.saleCurrency ?? mainCurrency;
  const rate = toDec(input.exchangeRate ?? 1);
  const fees = input.fees ?? [];
  const cost = toDec(input.costPrice);
  const targetValue = toDec(input.target.value);

  assertValidRate(input.vatRatePercent);
  if (cost.isNegative()) throw new PricingError('Le coût de revient doit être positif.');
  if (targetValue.isNegative()) throw new PricingError("L'objectif doit être positif.");
  if (!rate.greaterThan(0))
    throw new PricingError('Le taux de change doit être strictement positif.');
  if (fees.some((fee) => toDec(fee.value).isNegative())) {
    throw new PricingError('Les frais doivent être positifs.');
  }

  const vatRatio = percentToRatio(input.vatRatePercent);
  const fixedFees = sumFees(fees, (f) => f.mode === 'FIXED');
  const percentOnHt = percentToRatio(sumFees(fees, (f) => f.mode === 'PERCENT' && f.base === 'HT'));
  const percentOnTtc = percentToRatio(
    sumFees(fees, (f) => f.mode === 'PERCENT' && f.base === 'TTC'),
  );

  let denominator = new D(1).minus(percentOnHt).minus(percentOnTtc.times(vatRatio.plus(1)));
  let numerator = cost.plus(fixedFees);
  switch (input.target.type) {
    case 'AMOUNT':
      numerator = numerator.plus(targetValue);
      break;
    case 'MARKUP_PERCENT':
      numerator = numerator.plus(cost.times(percentToRatio(targetValue)));
      break;
    case 'MARGIN_RATE_PERCENT':
      denominator = denominator.minus(percentToRatio(targetValue));
      break;
  }
  if (!denominator.greaterThan(0)) {
    throw new PricingError(
      'Objectif inatteignable : la somme des pourcentages (frais et taux de marque) atteint ou dépasse 100 % du prix.',
    );
  }

  const exactHtMain = numerator.div(denominator);

  // Prix de vente dans la devise du pays (arrondi supérieur pour garantir l'objectif).
  const saleDecimals = currencyDecimals(saleCurrency);
  const saleHt = exactHtMain.times(rate).toDecimalPlaces(saleDecimals, D.ROUND_UP);
  const saleVat = roundMoney(saleHt.times(vatRatio), saleCurrency);
  const saleTtc = saleHt.plus(saleVat);

  // Analyse financière ramenée en devise principale, sur la base du prix réellement affiché.
  const htMain = saleHt.div(rate);
  const ttcMain = saleTtc.div(rate);
  const feeLines = fees.map((fee) => ({
    type: fee.type,
    label: fee.label?.trim() || fee.type,
    amount: feeAmount(fee, htMain, ttcMain),
  }));
  const totalFees = feeLines.reduce((acc, line) => acc.plus(line.amount), new D(0));
  const grossMargin = htMain.minus(cost);
  const profit = grossMargin.minus(totalFees);
  const targetProfit =
    input.target.type === 'AMOUNT'
      ? targetValue
      : input.target.type === 'MARKUP_PERCENT'
        ? cost.times(percentToRatio(targetValue))
        : htMain.times(percentToRatio(targetValue));

  const m = (value: Dec) => moneyString(value, mainCurrency);
  return {
    sale: {
      currency: saleCurrency,
      priceExclTax: saleHt.toFixed(saleDecimals),
      vatAmount: saleVat.toFixed(saleDecimals),
      priceInclTax: saleTtc.toFixed(saleDecimals),
    },
    vatRatePercent: toDec(input.vatRatePercent).toString(),
    exchangeRate: rate.toString(),
    breakdown: {
      currency: mainCurrency,
      revenueExclTax: m(htMain),
      vatCollected: m(saleVat.div(rate)),
      costPrice: m(cost),
      grossMargin: m(grossMargin),
      fees: feeLines.map((line) => ({
        type: line.type,
        label: line.label,
        amount: m(line.amount),
      })),
      totalFees: m(totalFees),
      profit: m(profit),
      targetProfit: m(targetProfit),
    },
  };
}

export interface CountryPricingContext {
  countryId: string;
  countryName: string;
  isoCode: string;
  currency: string;
  vatRatePercent: DecimalInput;
  exchangeRate: DecimalInput;
}

export type CountryComparisonRow =
  | { country: CountryPricingContext; ok: true; result: PricingResult }
  | { country: CountryPricingContext; ok: false; error: string };

/** Compare le prix cible d'un même produit entre plusieurs pays. */
export function compareCountries(
  base: Omit<PricingInput, 'vatRatePercent' | 'saleCurrency' | 'exchangeRate'>,
  countries: CountryPricingContext[],
): CountryComparisonRow[] {
  return countries.map((country) => {
    try {
      const result = computeTargetPrice({
        ...base,
        vatRatePercent: country.vatRatePercent,
        saleCurrency: country.currency,
        exchangeRate: country.exchangeRate,
      });
      return { country, ok: true, result };
    } catch (error) {
      if (error instanceof PricingError || error instanceof RangeError) {
        return { country, ok: false, error: error.message };
      }
      throw error;
    }
  });
}
