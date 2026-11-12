/**
 * Calculateur : TVA, prix cible pour un pays, comparaison multi-pays.
 * Les résultats sont calculés instantanément dans le navigateur avec le MÊME code métier
 * que le serveur (src/domain). L'enregistrement dans l'historique repasse par le serveur,
 * qui revalide et recalcule tout.
 */
import { useMemo, useState } from 'react';
import {
  compareCountries,
  computeTargetPrice,
  TARGET_TYPE_LABELS,
  type PricingResult,
  type TargetType,
} from '@/domain/pricing';
import { computeVat, type VatMode, type VatResult } from '@/domain/vat';
import {
  exchangeRateOf,
  standardRateOf,
  type CalculatorContext,
  type CountryOption,
} from '@/types/client';
import { formatMoney, formatPercent } from '@/utils/format';
import { apiFetch, errorMessage } from './api';
import { draftsToFees, FeesEditor, type FeeDraft } from './FeesEditor';
import { Alert, DISCLAIMER, Field, Stat } from './ui';

type Tab = 'vat' | 'target' | 'compare';

const normalize = (value: string) => value.trim().replace(',', '.');

function attempt<T>(fn: () => T): { value: T; error: null } | { value: null; error: string } {
  try {
    return { value: fn(), error: null };
  } catch (error) {
    return { value: null, error: errorMessage(error) };
  }
}

function RateSelect({
  country,
  value,
  onChange,
}: {
  country: CountryOption | undefined;
  value: string;
  onChange: (rate: string) => void;
}) {
  return (
    <fieldset>
      <legend className="label">Taux de TVA (%)</legend>
      <div className="flex gap-2">
        {country && country.vatRates.length > 0 ? (
          <select
            className="input min-w-0 flex-1"
            aria-label="Taux du pays"
            value={country.vatRates.some((r) => r.rate === value) ? value : ''}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          >
            <option value="">Personnalisé</option>
            {country.vatRates.map((rate) => (
              <option key={rate.id} value={rate.rate}>
                {formatPercent(rate.rate)} · {rate.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          className="input w-24 shrink-0"
          inputMode="decimal"
          aria-label="Taux de TVA"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {country && country.vatRates.length === 0
          ? 'Aucun taux renseigné pour ce pays : saisissez-le.'
          : 'Modifiable manuellement.'}
      </p>
    </fieldset>
  );
}

function SaveBar({
  onSave,
  disabled,
}: {
  onSave: (label: string) => Promise<void>;
  disabled: boolean;
}) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          placeholder="Libellé (facultatif)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Libellé du calcul"
        />
        <button
          type="button"
          className="btn btn-primary whitespace-nowrap"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            setStatus(null);
            try {
              await onSave(label);
              setStatus({ kind: 'success', text: 'Calcul enregistré dans l’historique.' });
              setLabel('');
            } catch (error) {
              setStatus({ kind: 'error', text: errorMessage(error) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer dans l’historique
        </button>
      </div>
      {status ? <Alert kind={status.kind}>{status.text}</Alert> : null}
    </div>
  );
}

function Breakdown({ result }: { result: PricingResult }) {
  const b = result.breakdown;
  const profitTone = Number(b.profit) >= Number(b.targetProfit) ? 'positive' : 'negative';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Prix de vente HT"
          value={formatMoney(result.sale.priceExclTax, result.sale.currency)}
        />
        <Stat
          label={`TVA (${formatPercent(result.vatRatePercent)})`}
          value={formatMoney(result.sale.vatAmount, result.sale.currency)}
          tone="muted"
        />
        <Stat
          label="Prix de vente TTC"
          value={formatMoney(result.sale.priceInclTax, result.sale.currency)}
        />
      </div>
      {result.sale.currency !== b.currency ? (
        <p className="text-sm text-slate-600">
          Taux de change appliqué : 1 {b.currency} = {Number(result.exchangeRate)}{' '}
          {result.sale.currency}.
        </p>
      ) : null}
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <caption className="px-3 pt-3 text-left text-sm font-semibold">
            Analyse financière par unité ({b.currency})
          </caption>
          <tbody>
            <tr>
              <td>Chiffre d’affaires HT</td>
              <td className="text-right tabular-nums">
                {formatMoney(b.revenueExclTax, b.currency)}
              </td>
            </tr>
            <tr>
              <td>− Coût de revient</td>
              <td className="text-right tabular-nums">{formatMoney(b.costPrice, b.currency)}</td>
            </tr>
            <tr className="font-semibold">
              <td>= Marge brute</td>
              <td className="text-right tabular-nums">{formatMoney(b.grossMargin, b.currency)}</td>
            </tr>
            {b.fees.map((fee, index) => (
              <tr key={index}>
                <td className="pl-6">− {fee.label}</td>
                <td className="text-right tabular-nums">{formatMoney(fee.amount, b.currency)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>= Bénéfice (objectif : {formatMoney(b.targetProfit, b.currency)})</td>
              <td
                className={`text-right tabular-nums ${profitTone === 'positive' ? 'text-green-700' : 'text-red-700'}`}
              >
                {formatMoney(b.profit, b.currency)}
              </td>
            </tr>
            <tr className="text-slate-600">
              <td>TVA collectée — reversée à l’État, ce n’est pas un gain</td>
              <td className="text-right tabular-nums">{formatMoney(b.vatCollected, b.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Calculator(context: CalculatorContext) {
  const { countries, products, mainCurrency } = context;
  const [tab, setTab] = useState<Tab>('vat');

  // --- Calculateur de TVA ---
  const [vatAmount, setVatAmount] = useState('100');
  const [vatCountryId, setVatCountryId] = useState(countries[0]?.id ?? '');
  const vatCountry = countries.find((c) => c.id === vatCountryId);
  const [vatRate, setVatRate] = useState(standardRateOf(vatCountry) ?? '20');
  const [vatMode, setVatMode] = useState<VatMode>('HT_TO_TTC');
  const vatCurrency = vatCountry?.currencyCode ?? mainCurrency;
  const vatResult = useMemo(
    () =>
      attempt<VatResult>(() =>
        computeVat({
          amount: normalize(vatAmount) || '0',
          ratePercent: normalize(vatRate) || '0',
          mode: vatMode,
          currency: vatCurrency,
        }),
      ),
    [vatAmount, vatRate, vatMode, vatCurrency],
  );

  // --- Paramètres communs prix cible / comparaison ---
  const [productId, setProductId] = useState('');
  const [costPrice, setCostPrice] = useState('20');
  const [targetType, setTargetType] = useState<TargetType>('AMOUNT');
  const [targetValue, setTargetValue] = useState(String(Number(context.defaultTargetAmount)));
  const [fees, setFees] = useState<FeeDraft[]>([]);
  const [targetCountryId, setTargetCountryId] = useState(countries[0]?.id ?? '');
  const targetCountry = countries.find((c) => c.id === targetCountryId);
  const [targetRate, setTargetRate] = useState(standardRateOf(targetCountry) ?? '');
  const [compareIds, setCompareIds] = useState<string[]>(countries.map((c) => c.id));

  const base = {
    costPrice: normalize(costPrice) || '0',
    target: { type: targetType, value: normalize(targetValue) || '0' },
    fees: draftsToFees(fees),
    mainCurrency,
  };

  const targetResult = useMemo(() => {
    if (!targetCountry) return { value: null, error: 'Sélectionnez un pays.' };
    const rate = exchangeRateOf(context, targetCountry.currencyCode);
    if (!rate)
      return {
        value: null,
        error: `Aucun taux de change ${mainCurrency} → ${targetCountry.currencyCode} n’est renseigné (page « Pays, TVA et devises »).`,
      };
    if (!normalize(targetRate)) return { value: null, error: 'Taux de TVA manquant pour ce pays.' };
    return attempt(() =>
      computeTargetPrice({
        ...base,
        vatRatePercent: normalize(targetRate),
        saleCurrency: targetCountry.currencyCode,
        exchangeRate: rate,
      }),
    );
  }, [costPrice, targetType, targetValue, fees, targetCountry, targetRate]);

  const comparison = useMemo(
    () =>
      compareCountries(
        base,
        countries
          .filter((c) => compareIds.includes(c.id))
          .map((c) => ({
            countryId: c.id,
            countryName: c.name,
            isoCode: c.isoCode,
            currency: c.currencyCode,
            vatRatePercent: standardRateOf(c) ?? '-1',
            exchangeRate: exchangeRateOf(context, c.currencyCode) ?? '0',
          })),
      ),
    [costPrice, targetType, targetValue, fees, compareIds],
  );

  const pickProduct = (id: string) => {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setCostPrice(String(Number(product.costPrice ?? product.purchasePrice)));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'vat', label: 'Calcul de TVA' },
    { id: 'target', label: 'Prix cible par pays' },
    { id: 'compare', label: 'Comparaison pays' },
  ];

  const pricingInputs = (
    <div className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produit (facultatif)">
          <select className="input" value={productId} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">— Saisie libre —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Coût de revient (${mainCurrency})`}>
          <input
            className="input"
            inputMode="decimal"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </Field>
        <Field label="Type d’objectif">
          <select
            className="input"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as TargetType)}
          >
            {(Object.keys(TARGET_TYPE_LABELS) as TargetType[]).map((type) => (
              <option key={type} value={type}>
                {TARGET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            targetType === 'AMOUNT'
              ? `Objectif de bénéfice (${mainCurrency} / produit)`
              : 'Objectif (%)'
          }
          hint="Bénéfice visé après coût de revient et frais, hors TVA."
        >
          <input
            className="input"
            inputMode="decimal"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
        </Field>
      </div>
      <FeesEditor fees={fees} onChange={setFees} currency={mainCurrency} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`-mb-px rounded-t-md border-2 px-4 py-2 text-base font-semibold ${tab === t.id ? 'border-slate-200 border-b-white bg-white text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {countries.length === 0 ? (
        <Alert kind="warning">Aucun pays actif. Ajoutez-en dans « Pays, TVA et devises ».</Alert>
      ) : null}

      {tab === 'vat' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-4">
            <fieldset>
              <legend className="label">Mode de calcul</legend>
              <div className="flex gap-4 text-sm">
                {(['HT_TO_TTC', 'TTC_TO_HT'] as VatMode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="vat-mode"
                      checked={vatMode === mode}
                      onChange={() => setVatMode(mode)}
                    />
                    {mode === 'HT_TO_TTC' ? 'HT → TTC' : 'TTC → HT'}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={`Prix ${vatMode === 'HT_TO_TTC' ? 'HT' : 'TTC'} (${vatCurrency})`}>
              <input
                className="input text-lg"
                inputMode="decimal"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
              />
            </Field>
            <Field label="Pays">
              <select
                className="input"
                value={vatCountryId}
                onChange={(e) => {
                  setVatCountryId(e.target.value);
                  const rate = standardRateOf(countries.find((c) => c.id === e.target.value));
                  if (rate) setVatRate(rate);
                }}
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currencyCode})
                  </option>
                ))}
              </select>
            </Field>
            <RateSelect country={vatCountry} value={vatRate} onChange={setVatRate} />
          </div>
          <div className="space-y-3">
            {vatResult.error ? (
              <Alert>{vatResult.error}</Alert>
            ) : vatResult.value ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat
                    label="Prix HT"
                    value={formatMoney(vatResult.value.priceExclTax, vatCurrency)}
                  />
                  <Stat
                    label="Montant de TVA"
                    value={formatMoney(vatResult.value.vatAmount, vatCurrency)}
                    tone="muted"
                  />
                  <Stat
                    label="Prix TTC"
                    value={formatMoney(vatResult.value.priceInclTax, vatCurrency)}
                  />
                  <Stat
                    label="Taux appliqué"
                    value={formatPercent(vatResult.value.ratePercent)}
                    tone="muted"
                  />
                </div>
                <SaveBar
                  disabled={false}
                  onSave={async (label) => {
                    await apiFetch('/api/history', {
                      method: 'POST',
                      body: {
                        kind: 'VAT',
                        input: {
                          amount: normalize(vatAmount),
                          ratePercent: normalize(vatRate),
                          mode: vatMode,
                          countryId: vatCountryId || null,
                          label,
                        },
                      },
                    });
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'target' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {pricingInputs}
            <div className="card grid gap-4 sm:grid-cols-2">
              <Field label="Pays de destination">
                <select
                  className="input"
                  value={targetCountryId}
                  onChange={(e) => {
                    setTargetCountryId(e.target.value);
                    setTargetRate(
                      standardRateOf(countries.find((c) => c.id === e.target.value)) ?? '',
                    );
                  }}
                >
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currencyCode})
                    </option>
                  ))}
                </select>
              </Field>
              <RateSelect country={targetCountry} value={targetRate} onChange={setTargetRate} />
            </div>
          </div>
          <div className="space-y-3">
            {targetResult.error ? (
              <Alert>{targetResult.error}</Alert>
            ) : targetResult.value ? (
              <Breakdown result={targetResult.value} />
            ) : null}
            <SaveBar
              disabled={!targetResult.value}
              onSave={async (label) => {
                await apiFetch('/api/history', {
                  method: 'POST',
                  body: {
                    kind: 'INTERNATIONAL',
                    input: {
                      ...base,
                      countryId: targetCountryId,
                      vatRatePercent: normalize(targetRate),
                      productId: productId || null,
                      label,
                    },
                  },
                });
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === 'compare' ? (
        <div className="space-y-4">
          {pricingInputs}
          <div className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="label mb-0">Pays comparés</span>
              <button
                type="button"
                className="btn px-2 py-1 text-sm"
                onClick={() => setCompareIds(countries.map((c) => c.id))}
              >
                Tous
              </button>
              <button
                type="button"
                className="btn px-2 py-1 text-sm"
                onClick={() => setCompareIds([])}
              >
                Aucun
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {countries.map((c) => (
                <label key={c.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(c.id)}
                    onChange={(e) =>
                      setCompareIds(
                        e.target.checked
                          ? [...compareIds, c.id]
                          : compareIds.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Pays</th>
                  <th className="text-right">TVA</th>
                  <th className="text-right">Prix HT</th>
                  <th className="text-right">Montant TVA</th>
                  <th className="text-right">Prix TTC</th>
                  <th className="text-right">Bénéfice ({mainCurrency})</th>
                </tr>
              </thead>
              <tbody>
                {comparison.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-600">
                      Sélectionnez au moins un pays.
                    </td>
                  </tr>
                ) : (
                  comparison.map((row) => (
                    <tr key={row.country.countryId}>
                      <td className="font-medium">{row.country.countryName}</td>
                      {row.ok ? (
                        <>
                          <td className="text-right tabular-nums">
                            {formatPercent(row.result.vatRatePercent)}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatMoney(row.result.sale.priceExclTax, row.result.sale.currency)}
                          </td>
                          <td className="text-right tabular-nums text-slate-600">
                            {formatMoney(row.result.sale.vatAmount, row.result.sale.currency)}
                          </td>
                          <td className="text-right font-semibold tabular-nums">
                            {formatMoney(row.result.sale.priceInclTax, row.result.sale.currency)}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatMoney(row.result.breakdown.profit, mainCurrency)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={5} className="text-amber-800">
                          Données incomplètes (taux de TVA standard ou taux de change manquant) :{' '}
                          {row.error}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-slate-600">{DISCLAIMER}</p>
    </div>
  );
}
