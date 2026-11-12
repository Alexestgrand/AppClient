/** Données transmises par les pages Astro aux composants interactifs. */
export interface CountryOption {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  vatRates: { id: string; label: string; type: string; rate: string }[];
}

export interface ProductOption {
  id: string;
  name: string;
  reference: string;
  purchasePrice: string;
  costPrice: string | null;
  warehouseId: string | null;
}

export interface CalculatorContext {
  countries: CountryOption[];
  products: ProductOption[];
  /** Taux de change par devise (1 devise principale = x devise). */
  exchangeRates: Record<string, string>;
  mainCurrency: string;
  defaultTargetAmount: string;
}

export function standardRateOf(country: CountryOption | undefined): string | null {
  return country?.vatRates.find((rate) => rate.type === 'STANDARD')?.rate ?? null;
}

export function exchangeRateOf(
  context: Pick<CalculatorContext, 'exchangeRates' | 'mainCurrency'>,
  currency: string,
): string | null {
  return currency === context.mainCurrency ? '1' : (context.exchangeRates[currency] ?? null);
}
