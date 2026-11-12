/** Saisie et liste des ventes, avec aperçu instantané de la ventilation financière. */
import { useMemo, useState, type SubmitEvent } from 'react';
import { computeSaleFinancials } from '@/domain/sales';
import { exchangeRateOf, standardRateOf, type CalculatorContext } from '@/types/client';
import { formatDate, formatMoney, formatPercent } from '@/utils/format';
import { ApiError, apiFetch, errorMessage } from './api';
import { draftsToFees, FeesEditor, type FeeDraft } from './FeesEditor';
import { Alert, Field } from './ui';
import { useOpenOnNew } from './useOpenOnNew';

export interface SaleRow {
  id: string;
  saleDate: string;
  productName: string;
  quantity: number;
  currency: string;
  unitPriceExclTax: string;
  vatRate: string;
  revenueExclTax: string;
  vatCollected: string;
  profit: string;
  country: { name: string; isoCode: string };
  warehouse: { name: string } | null;
}

interface Props extends CalculatorContext {
  initialRows: SaleRow[];
  warehouses: { id: string; name: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);
const normalize = (value: string) => value.trim().replace(',', '.');

export default function SalesManager(props: Props) {
  const { countries, products, warehouses, mainCurrency } = props;
  const [rows, setRows] = useState(props.initialRows);
  const [open, setOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(today());
  const [productId, setProductId] = useState('');
  const [countryId, setCountryId] = useState(countries[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const country = countries.find((c) => c.id === countryId);
  const [vatRate, setVatRate] = useState(standardRateOf(country) ?? '');
  const [fees, setFees] = useState<FeeDraft[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const product = products.find((p) => p.id === productId);
  const currency = country?.currencyCode ?? mainCurrency;
  const exchangeRate = exchangeRateOf(props, currency);

  const preview = useMemo(() => {
    if (!product || !exchangeRate || !normalize(unitPrice) || !normalize(vatRate)) return null;
    try {
      return computeSaleFinancials({
        quantity: Number(quantity),
        unitPriceExclTax: normalize(unitPrice),
        vatRatePercent: normalize(vatRate),
        exchangeRate,
        unitCost: product.costPrice ?? product.purchasePrice,
        fees: draftsToFees(fees),
        saleCurrency: currency,
        mainCurrency,
      });
    } catch {
      return null;
    }
  }, [product, exchangeRate, unitPrice, vatRate, quantity, fees, currency, mainCurrency]);

  useOpenOnNew(() => setOpen(true));

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiFetch('/api/sales', {
        method: 'POST',
        body: {
          saleDate,
          productId,
          countryId,
          warehouseId: warehouseId || null,
          quantity,
          unitPriceExclTax: unitPrice,
          vatRatePercent: vatRate || null,
          fees: draftsToFees(fees),
          note,
        },
      });
      setRows(await apiFetch<SaleRow[]>('/api/sales'));
      setNotice('Vente enregistrée.');
      setOpen(false);
      setUnitPrice('');
      setQuantity('1');
      setNote('');
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer cette vente ? Cette action est définitive.')) return;
    try {
      await apiFetch(`/api/sales/${id}`, { method: 'DELETE' });
      setRows((current) => current.filter((row) => row.id !== id));
      setNotice('Vente supprimée.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setOpen(!open);
            setNotice(null);
            setError(null);
          }}
        >
          {open ? 'Fermer le formulaire' : '+ Enregistrer une vente'}
        </button>
      </div>
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error && !open ? <Alert>{error}</Alert> : null}

      {open ? (
        <form className="card space-y-4" onSubmit={submit} noValidate>
          {error ? <Alert>{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date *" error={fieldErrors.saleDate}>
              <input
                className="input"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </Field>
            <Field label="Produit *" error={fieldErrors.productId}>
              <select
                className="input"
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setWarehouseId(products.find((p) => p.id === e.target.value)?.warehouseId ?? '');
                }}
              >
                <option value="">— Choisir —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pays de vente *" error={fieldErrors.countryId}>
              <select
                className="input"
                value={countryId}
                onChange={(e) => {
                  setCountryId(e.target.value);
                  setVatRate(standardRateOf(countries.find((c) => c.id === e.target.value)) ?? '');
                }}
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currencyCode})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entrepôt d’expédition" hint="Par défaut : l’entrepôt du produit.">
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">— Aucun —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantité *" error={fieldErrors.quantity}>
              <input
                className="input"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label={`Prix unitaire HT (${currency}) *`} error={fieldErrors.unitPriceExclTax}>
              <input
                className="input"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Field>
            <Field
              label="Taux de TVA (%)"
              error={fieldErrors.vatRatePercent}
              hint="Taux standard du pays par défaut."
            >
              <input
                className="input"
                inputMode="decimal"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
              />
            </Field>
            <Field label="Note">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {!exchangeRate ? (
            <Alert kind="warning">
              Aucun taux de change {mainCurrency} → {currency} : renseignez-le dans « Pays et
              fiscalité ».
            </Alert>
          ) : null}
          <FeesEditor fees={fees} onChange={setFees} currency={mainCurrency} />
          {preview ? (
            <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-5">
              <div>
                CA HT
                <br />
                <strong>{formatMoney(preview.revenueExclTax, mainCurrency)}</strong>
              </div>
              <div>
                TVA collectée
                <br />
                <strong className="text-slate-600">
                  {formatMoney(preview.vatCollected, mainCurrency)}
                </strong>
              </div>
              <div>
                Coût
                <br />
                <strong>{formatMoney(preview.totalCost, mainCurrency)}</strong>
              </div>
              <div>
                Frais
                <br />
                <strong>{formatMoney(preview.totalFees, mainCurrency)}</strong>
              </div>
              <div>
                Bénéfice
                <br />
                <strong className={Number(preview.profit) >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatMoney(preview.profit, mainCurrency)}
                </strong>
              </div>
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer la vente'}
          </button>
        </form>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Pays</th>
              <th>Entrepôt</th>
              <th className="text-right">Qté</th>
              <th className="text-right">PU HT</th>
              <th className="text-right">TVA</th>
              <th className="text-right">CA HT ({mainCurrency})</th>
              <th className="text-right">Bénéfice ({mainCurrency})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-600">
                  Aucune vente enregistrée.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">{formatDate(row.saleDate)}</td>
                  <td>{row.productName}</td>
                  <td>{row.country.name}</td>
                  <td>{row.warehouse?.name ?? '—'}</td>
                  <td className="text-right tabular-nums">{row.quantity}</td>
                  <td className="text-right tabular-nums">
                    {formatMoney(row.unitPriceExclTax, row.currency)}
                  </td>
                  <td className="text-right tabular-nums">{formatPercent(row.vatRate)}</td>
                  <td className="text-right tabular-nums">
                    {formatMoney(row.revenueExclTax, mainCurrency)}
                  </td>
                  <td
                    className={`text-right tabular-nums ${Number(row.profit) >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {formatMoney(row.profit, mainCurrency)}
                  </td>
                  <td className="text-right">
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
