/**
 * Arithmétique monétaire : tous les calculs passent par Decimal (pas de flottants JS).
 * Les valeurs intermédiaires restent en pleine précision ; on n'arrondit qu'à la sortie.
 */
import Decimal from 'decimal.js';

// Instance dédiée : précision élevée, arrondi commercial (demi supérieur, s'éloignant de zéro).
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type DecimalInput = Dec | string | number;

/** Nombre de décimales usuel par devise (ISO 4217). Par défaut : 2. */
const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  ISK: 0,
  CLP: 0,
  VND: 0,
  HUF: 2,
  KWD: 3,
  BHD: 3,
  TND: 3,
};

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

export function toDec(value: DecimalInput): Dec {
  return new D(value);
}

/** Arrondi monétaire selon la devise (demi supérieur). */
export function roundMoney(value: DecimalInput, currency = 'EUR'): Dec {
  return toDec(value).toDecimalPlaces(currencyDecimals(currency), D.ROUND_HALF_UP);
}

/** Représentation texte arrondie, adaptée au stockage et à l'API. */
export function moneyString(value: DecimalInput, currency = 'EUR'): string {
  return roundMoney(value, currency).toFixed(currencyDecimals(currency));
}

/** Taux exprimé en pourcentage (ex. 20) → coefficient (0,20). */
export function percentToRatio(percent: DecimalInput): Dec {
  return toDec(percent).div(100);
}
