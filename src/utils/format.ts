/** Formatage d'affichage (fr-FR). Les valeurs arrivent en chaînes décimales exactes. */
export function formatMoney(
  value: string | number | { toString(): string },
  currency = 'EUR',
): string {
  const amount = Number(value.toString());
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(value: string | number | { toString(): string }): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(value.toString()))} %`;
}

export function formatDate(value: string | Date, withTime = false): string {
  return new Intl.DateTimeFormat(
    'fr-FR',
    withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' },
  ).format(new Date(value));
}
