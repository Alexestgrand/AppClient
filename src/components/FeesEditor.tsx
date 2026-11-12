import { FEE_TYPE_LABELS, FEE_TYPES, type FeeType } from '@/domain/pricing';

export interface FeeDraft {
  type: FeeType;
  label: string;
  mode: 'FIXED' | 'PERCENT';
  base: 'HT' | 'TTC';
  value: string;
}

/** Convertit les brouillons de l'interface en frais valides pour le domaine (lignes vides ignorées). */
export function draftsToFees(drafts: FeeDraft[]) {
  return drafts
    .filter(
      (fee) => fee.value.trim() !== '' && Number.isFinite(Number(fee.value.replace(',', '.'))),
    )
    .map((fee) => {
      const value = fee.value.replace(',', '.');
      return fee.mode === 'FIXED'
        ? { type: fee.type, label: fee.label || null, mode: 'FIXED' as const, value }
        : {
            type: fee.type,
            label: fee.label || null,
            mode: 'PERCENT' as const,
            base: fee.base,
            value,
          };
    });
}

export function FeesEditor({
  fees,
  onChange,
  currency,
}: {
  fees: FeeDraft[];
  onChange: (fees: FeeDraft[]) => void;
  currency: string;
}) {
  const update = (index: number, patch: Partial<FeeDraft>) =>
    onChange(fees.map((fee, i) => (i === index ? { ...fee, ...patch } : fee)));
  return (
    <fieldset className="space-y-2">
      <legend className="label">Frais supplémentaires (par unité)</legend>
      {fees.length === 0 ? (
        <p className="text-sm text-slate-600">
          Aucun frais. Transport, douane, plateforme, paiement…
        </p>
      ) : null}
      {fees.map((fee, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <select
            className="input"
            aria-label="Type de frais"
            value={fee.type}
            onChange={(e) => update(index, { type: e.target.value as FeeType })}
          >
            {FEE_TYPES.map((type) => (
              <option key={type} value={type}>
                {FEE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Mode"
            value={fee.mode === 'FIXED' ? 'FIXED' : `PERCENT_${fee.base}`}
            onChange={(e) => {
              const v = e.target.value;
              update(
                index,
                v === 'FIXED'
                  ? { mode: 'FIXED' }
                  : { mode: 'PERCENT', base: v === 'PERCENT_TTC' ? 'TTC' : 'HT' },
              );
            }}
          >
            <option value="FIXED">Montant fixe ({currency})</option>
            <option value="PERCENT_HT">% du prix HT</option>
            <option value="PERCENT_TTC">% du prix TTC</option>
          </select>
          <input
            className="input"
            aria-label="Valeur"
            inputMode="decimal"
            placeholder={fee.mode === 'FIXED' ? '0,00' : '%'}
            value={fee.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
          <input
            className="input"
            aria-label="Libellé"
            placeholder="Libellé (facultatif)"
            value={fee.label}
            onChange={(e) => update(index, { label: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-danger col-span-2 sm:col-span-1"
            onClick={() => onChange(fees.filter((_, i) => i !== index))}
            aria-label="Retirer ce frais"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange([
            ...fees,
            { type: 'TRANSPORT', label: '', mode: 'FIXED', base: 'HT', value: '' },
          ])
        }
      >
        + Ajouter un frais
      </button>
    </fieldset>
  );
}
