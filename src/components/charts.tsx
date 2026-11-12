/**
 * Graphiques SVG légers, rendus côté serveur (aucune bibliothèque, aucun JavaScript client).
 * Couleurs : CA en bleu, bénéfice en vert, TVA collectée en gris (jamais confondue avec un gain).
 */
import { formatMoney } from '@/utils/format';

export interface ChartRow {
  label: string;
  revenue: string;
  profit: string;
  vat: string;
}

const SERIES = [
  { key: 'revenue', label: 'CA HT', color: '#1d4ed8' },
  { key: 'profit', label: 'Bénéfice', color: '#15803d' },
  { key: 'vat', label: 'TVA collectée', color: '#94a3b8' },
] as const;

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Barres horizontales groupées : lisibles sur mobile, libellés longs acceptés. */
export function GroupedBarChart({
  rows,
  currency,
  emptyText = 'Aucune donnée sur la période.',
}: {
  rows: ChartRow[];
  currency: string;
  emptyText?: string;
}) {
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-slate-600">{emptyText}</p>;
  const max = Math.max(
    1,
    ...rows.flatMap((row) => SERIES.map((s) => Math.abs(Number(row[s.key])))),
  );
  return (
    <div className="space-y-4">
      <Legend />
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 text-sm font-medium">{row.label}</div>
          <div className="space-y-1">
            {SERIES.map((s) => {
              const value = Number(row[s.key]);
              const width = (Math.abs(value) / max) * 100;
              return (
                <div
                  key={s.key}
                  className="flex items-center gap-2"
                  title={`${s.label} : ${formatMoney(value, currency)}`}
                >
                  <div className="h-3 flex-1 rounded-sm bg-slate-100">
                    <div
                      className="h-3 rounded-sm"
                      style={{
                        width: `${width}%`,
                        backgroundColor: value < 0 ? '#b91c1c' : s.color,
                      }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm tabular-nums text-slate-700">
                    {formatMoney(value, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Évolution mensuelle : colonnes CA / bénéfice / TVA. */
export function MonthlyChart({ rows, currency }: { rows: ChartRow[]; currency: string }) {
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-slate-600">Aucune vente sur la période.</p>;
  const width = 640;
  const height = 220;
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const values = rows.flatMap((row) => SERIES.map((s) => Number(row[s.key])));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const innerH = height - padding.top - padding.bottom;
  const y = (value: number) => padding.top + ((max - value) / (max - min)) * innerH;
  const groupW = (width - padding.left - padding.right) / rows.length;
  const barW = Math.min(28, (groupW * 0.8) / SERIES.length);
  const monthLabel = (label: string) => {
    const [year, month] = label.split('-');
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(
      new Date(Number(year), Number(month) - 1, 1),
    );
  };
  return (
    <div className="space-y-2">
      <Legend />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Évolution mensuelle du chiffre d'affaires, du bénéfice et de la TVA collectée"
      >
        <line x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
        {rows.map((row, i) => {
          const x0 = padding.left + i * groupW + (groupW - barW * SERIES.length) / 2;
          return (
            <g key={row.label}>
              {SERIES.map((s, j) => {
                const value = Number(row[s.key]);
                const top = Math.min(y(value), y(0));
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * barW}
                    y={top}
                    width={barW - 2}
                    height={Math.max(1, Math.abs(y(value) - y(0)))}
                    fill={value < 0 ? '#b91c1c' : s.color}
                    rx={2}
                  >
                    <title>{`${monthLabel(row.label)} · ${s.label} : ${formatMoney(value, currency)}`}</title>
                  </rect>
                );
              })}
              <text
                x={padding.left + i * groupW + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
              >
                {monthLabel(row.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Répartition en pourcentage (barre empilée) : part de CA par pays / entrepôt. */
export function ShareBar({ rows, currency }: { rows: ChartRow[]; currency: string }) {
  const total = rows.reduce((acc, row) => acc + Math.max(0, Number(row.revenue)), 0);
  if (total <= 0) return null;
  const palette = [
    '#1d4ed8',
    '#0891b2',
    '#7c3aed',
    '#c2410c',
    '#15803d',
    '#be185d',
    '#4d7c0f',
    '#475569',
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded">
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              width: `${(Math.max(0, Number(row.revenue)) / total) * 100}%`,
              backgroundColor: palette[i % palette.length],
            }}
            title={`${row.label} : ${formatMoney(row.revenue, currency)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {rows.map((row, i) => (
          <span key={row.label} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: palette[i % palette.length] }}
            />
            {row.label} · {((Math.max(0, Number(row.revenue)) / total) * 100).toFixed(1)} %
          </span>
        ))}
      </div>
    </div>
  );
}
