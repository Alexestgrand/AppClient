import type { Period } from '@/repositories/sale.repository';

/** Lit une période « from / to » (AAAA-MM-JJ) ; les dates invalides sont ignorées. */
export function parsePeriod(params: URLSearchParams): Period {
  const parse = (value: string | null, endOfDay: boolean) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}Z`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  return { from: parse(params.get('from'), false), to: parse(params.get('to'), true) };
}
