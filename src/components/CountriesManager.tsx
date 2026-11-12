import { EntityManager, type FormValues } from './EntityManager';
import { formatDate, formatPercent } from '@/utils/format';

type VatRateType = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'ZERO';

export interface CountryRow {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  isActive: boolean;
  taxSource: string | null;
  taxSourceUrl: string | null;
  lastVerifiedAt: string | null;
  vatRates: { id: string; label: string; type: VatRateType; rate: string }[];
}

const RATE_TYPES: { value: VatRateType; label: string }[] = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'REDUCED', label: 'Réduit' },
  { value: 'SUPER_REDUCED', label: 'Super-réduit' },
  { value: 'ZERO', label: 'Zéro' },
];

interface RateDraft {
  label: string;
  type: VatRateType;
  rate: string;
}

// Les taux sont stockés en JSON dans une valeur de formulaire pour réutiliser le gestionnaire générique.
const readRates = (values: FormValues): RateDraft[] =>
  JSON.parse(String(values.vatRates ?? '[]')) as RateDraft[];

export default function CountriesManager({ initialRows }: { initialRows: CountryRow[] }) {
  return (
    <EntityManager<CountryRow>
      endpoint="/api/countries"
      entityLabel="Pays"
      initialRows={initialRows}
      localSearch={(row) => `${row.name} ${row.isoCode} ${row.currencyCode}`}
      columns={[
        {
          header: 'Pays',
          render: (row) => (
            <span className="font-medium">
              {row.name} <span className="text-slate-600">({row.isoCode})</span>
            </span>
          ),
        },
        { header: 'Devise', render: (row) => row.currencyCode },
        {
          header: 'Taux de TVA',
          render: (row) =>
            row.vatRates.length ? (
              <ul>
                {row.vatRates.map((rate) => (
                  <li key={rate.id} className={rate.type === 'STANDARD' ? 'font-semibold' : ''}>
                    {formatPercent(rate.rate)} · {rate.label}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-amber-700">Aucun taux renseigné</span>
            ),
        },
        {
          header: 'Source',
          render: (row) =>
            row.taxSourceUrl ? (
              <a
                className="text-blue-700 underline"
                href={row.taxSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.taxSource ?? 'Lien'}
              </a>
            ) : (
              (row.taxSource ?? '—')
            ),
        },
        {
          header: 'Vérifié le',
          render: (row) =>
            row.lastVerifiedAt ? (
              formatDate(row.lastVerifiedAt)
            ) : (
              <span className="badge bg-amber-100 text-amber-800">À vérifier</span>
            ),
        },
        { header: 'Statut', render: (row) => (row.isActive ? 'Actif' : 'Inactif') },
      ]}
      fields={[
        { name: 'name', label: 'Nom', type: 'text', required: true },
        {
          name: 'isoCode',
          label: 'Code ISO (2 lettres)',
          type: 'text',
          required: true,
          placeholder: 'FR',
        },
        {
          name: 'currencyCode',
          label: 'Devise (ISO 4217)',
          type: 'text',
          required: true,
          placeholder: 'EUR',
        },
        { name: 'isActive', label: 'Pays actif', type: 'checkbox' },
        { name: 'taxSource', label: 'Source des informations fiscales', type: 'text' },
        { name: 'taxSourceUrl', label: 'URL de la source', type: 'text', placeholder: 'https://…' },
        {
          name: 'lastVerifiedAt',
          label: 'Date de dernière vérification',
          type: 'date',
          hint: 'À renseigner après avoir contrôlé les taux auprès de la source officielle.',
        },
      ]}
      toForm={(row) => ({
        name: row?.name ?? '',
        isoCode: row?.isoCode ?? '',
        currencyCode: row?.currencyCode ?? 'EUR',
        isActive: row?.isActive ?? true,
        taxSource: row?.taxSource ?? '',
        taxSourceUrl: row?.taxSourceUrl ?? '',
        lastVerifiedAt: row?.lastVerifiedAt?.slice(0, 10) ?? '',
        vatRates: JSON.stringify(
          row?.vatRates.map(({ label, type, rate }) => ({ label, type, rate })) ?? [
            { label: 'Taux standard', type: 'STANDARD', rate: '' },
          ],
        ),
      })}
      toBody={(values) => ({ ...values, vatRates: readRates(values) })}
      extraForm={(values, setValues, fieldErrors) => {
        const rates = readRates(values);
        const update = (next: RateDraft[]) =>
          setValues({ ...values, vatRates: JSON.stringify(next) });
        return (
          <fieldset className="space-y-2">
            <legend className="label">Taux de TVA (en %)</legend>
            {rates.map((rate, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <input
                  className="input col-span-2 sm:col-span-1"
                  aria-label="Libellé"
                  placeholder="Libellé"
                  value={rate.label}
                  onChange={(e) =>
                    update(rates.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
                  }
                />
                <select
                  className="input"
                  aria-label="Type"
                  value={rate.type}
                  onChange={(e) =>
                    update(
                      rates.map((r, i) =>
                        i === index ? { ...r, type: e.target.value as VatRateType } : r,
                      ),
                    )
                  }
                >
                  {RATE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  aria-label="Taux"
                  inputMode="decimal"
                  placeholder="20"
                  value={rate.rate}
                  onChange={(e) =>
                    update(rates.map((r, i) => (i === index ? { ...r, rate: e.target.value } : r)))
                  }
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => update(rates.filter((_, i) => i !== index))}
                  aria-label="Retirer ce taux"
                >
                  ✕
                </button>
              </div>
            ))}
            {fieldErrors.vatRates ? (
              <p className="text-sm text-red-700">{fieldErrors.vatRates.join(' ')}</p>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() =>
                update([...rates, { label: 'Taux réduit', type: 'REDUCED', rate: '' }])
              }
            >
              + Ajouter un taux
            </button>
          </fieldset>
        );
      }}
    />
  );
}
