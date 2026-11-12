import { useEffect, useState } from 'react';
import { formatDate, formatMoney, formatPercent } from '@/utils/format';
import { apiFetch, errorMessage } from './api';
import { Alert } from './ui';

export interface HistoryRow {
  id: string;
  type: 'VAT' | 'INTERNATIONAL';
  createdAt: string;
  label: string | null;
  countryName: string | null;
  currency: string;
  initialPrice: string;
  vatRate: string;
  priceExclTax: string;
  vatAmount: string;
  priceInclTax: string;
  targetAmount: string | null;
  profit: string | null;
  details: unknown;
  product: { id: string; name: string; reference: string } | null;
}

const TYPE_LABEL = { VAT: 'TVA', INTERNATIONAL: 'Prix cible' } as const;

export default function HistoryManager({
  initialRows,
  countries,
  mainCurrency,
}: {
  initialRows: HistoryRow[];
  countries: { id: string; name: string }[];
  mainCurrency: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [countryId, setCountryId] = useState('');
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (countryId) params.set('countryId', countryId);
    const timer = setTimeout(() => {
      apiFetch<HistoryRow[]>(`/api/history?${params}`)
        .then(setRows)
        .catch((e: unknown) => setError(errorMessage(e)));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, type, countryId, touched]);

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer ce calcul de l’historique ?')) return;
    try {
      await apiFetch(`/api/history/${id}`, { method: 'DELETE' });
      setRows((current) => current.filter((row) => row.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input sm:max-w-xs"
          type="search"
          placeholder="Libellé, pays, produit…"
          aria-label="Rechercher"
          value={search}
          onChange={(e) => {
            setTouched(true);
            setSearch(e.target.value);
          }}
        />
        <select
          className="input sm:max-w-xs"
          aria-label="Type"
          value={type}
          onChange={(e) => {
            setTouched(true);
            setType(e.target.value);
          }}
        >
          <option value="">Type : tous</option>
          <option value="VAT">Calcul de TVA</option>
          <option value="INTERNATIONAL">Prix cible</option>
        </select>
        <select
          className="input sm:max-w-xs"
          aria-label="Pays"
          value={countryId}
          onChange={(e) => {
            setTouched(true);
            setCountryId(e.target.value);
          }}
        >
          <option value="">Pays : tous</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {selected ? (
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Détail du calcul du {formatDate(selected.createdAt, true)}
            </h2>
            <button type="button" className="btn" onClick={() => setSelected(null)}>
              Fermer
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-slate-600">Type</dt>
            <dd>{TYPE_LABEL[selected.type]}</dd>
            <dt className="text-slate-600">Pays</dt>
            <dd>{selected.countryName ?? '—'}</dd>
            <dt className="text-slate-600">Produit</dt>
            <dd>
              {selected.product ? `${selected.product.reference} · ${selected.product.name}` : '—'}
            </dd>
            <dt className="text-slate-600">
              {selected.type === 'VAT' ? 'Prix initial' : `Coût de revient (${mainCurrency})`}
            </dt>
            <dd>
              {formatMoney(
                selected.initialPrice,
                selected.type === 'VAT' ? selected.currency : mainCurrency,
              )}
            </dd>
            <dt className="text-slate-600">Taux de TVA</dt>
            <dd>{formatPercent(selected.vatRate)}</dd>
            <dt className="text-slate-600">Prix HT</dt>
            <dd>{formatMoney(selected.priceExclTax, selected.currency)}</dd>
            <dt className="text-slate-600">TVA</dt>
            <dd>{formatMoney(selected.vatAmount, selected.currency)}</dd>
            <dt className="text-slate-600">Prix TTC</dt>
            <dd>{formatMoney(selected.priceInclTax, selected.currency)}</dd>
            {selected.targetAmount ? (
              <>
                <dt className="text-slate-600">Objectif</dt>
                <dd>{formatMoney(selected.targetAmount, mainCurrency)}</dd>
              </>
            ) : null}
            {selected.profit ? (
              <>
                <dt className="text-slate-600">Bénéfice obtenu</dt>
                <dd>{formatMoney(selected.profit, mainCurrency)}</dd>
              </>
            ) : null}
          </dl>
          <details>
            <summary className="cursor-pointer text-sm text-slate-600">
              Données complètes (entrées, frais, ventilation)
            </summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3 text-sm">
              {JSON.stringify(selected.details, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Libellé / produit</th>
              <th>Pays</th>
              <th className="text-right">TVA</th>
              <th className="text-right">HT</th>
              <th className="text-right">TTC</th>
              <th className="text-right">Bénéfice</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-600">
                  Aucun calcul enregistré.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">{formatDate(row.createdAt, true)}</td>
                  <td>{TYPE_LABEL[row.type]}</td>
                  <td>{row.label ?? row.product?.name ?? '—'}</td>
                  <td>{row.countryName ?? '—'}</td>
                  <td className="text-right tabular-nums">{formatPercent(row.vatRate)}</td>
                  <td className="text-right tabular-nums">
                    {formatMoney(row.priceExclTax, row.currency)}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatMoney(row.priceInclTax, row.currency)}
                  </td>
                  <td className="text-right tabular-nums">
                    {row.profit ? formatMoney(row.profit, mainCurrency) : '—'}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn mr-1 px-2 py-1"
                      onClick={() => setSelected(row)}
                    >
                      Détails
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger px-2 py-1"
                      onClick={() => void remove(row.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
