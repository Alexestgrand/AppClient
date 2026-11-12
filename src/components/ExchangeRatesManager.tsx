import { EntityManager } from './EntityManager';
import { formatDate } from '@/utils/format';

export interface ExchangeRateRow {
  id: string;
  currencyCode: string;
  rate: string;
  source: string | null;
  rateDate: string;
}

export default function ExchangeRatesManager({
  initialRows,
  mainCurrency,
}: {
  initialRows: ExchangeRateRow[];
  mainCurrency: string;
}) {
  return (
    <EntityManager<ExchangeRateRow>
      endpoint="/api/exchange-rates"
      entityLabel="Taux de change"
      quickAdd={false}
      initialRows={initialRows}
      columns={[
        {
          header: 'Devise',
          render: (row) => <span className="font-medium">{row.currencyCode}</span>,
        },
        {
          header: `1 ${mainCurrency} =`,
          render: (row) => `${Number(row.rate)} ${row.currencyCode}`,
          className: 'tabular-nums',
        },
        { header: 'Source', render: (row) => row.source ?? '—' },
        { header: 'Date du taux', render: (row) => formatDate(row.rateDate) },
      ]}
      fields={[
        {
          name: 'currencyCode',
          label: 'Devise (ISO 4217)',
          type: 'text',
          required: true,
          placeholder: 'CHF',
        },
        {
          name: 'rate',
          label: `Taux : nombre d'unités pour 1 ${mainCurrency}`,
          type: 'decimal',
          required: true,
        },
        {
          name: 'source',
          label: 'Source',
          type: 'text',
          placeholder: 'ex. BCE, taux de référence',
        },
        { name: 'rateDate', label: 'Date du taux', type: 'date' },
      ]}
      toForm={(row) => ({
        currencyCode: row?.currencyCode ?? '',
        rate: row?.rate ?? '',
        source: row?.source ?? '',
        rateDate: (row?.rateDate ?? new Date().toISOString()).slice(0, 10),
      })}
    />
  );
}
