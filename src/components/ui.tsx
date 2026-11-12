import type { ReactNode } from 'react';

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string[] | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-slate-600">{hint}</span> : null}
      {error?.length ? (
        <span className="mt-1 block text-sm text-red-700">{error.join(' ')}</span>
      ) : null}
    </label>
  );
}

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[kind];
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: 'default' | 'muted' | 'positive' | 'negative';
}) {
  const color = {
    default: 'text-slate-900',
    muted: 'text-slate-600',
    positive: 'text-green-700',
    negative: 'text-red-700',
  }[tone];
  return (
    <div className="card">
      <div className="text-sm font-medium tracking-wide text-slate-600 uppercase">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-600">{hint}</div> : null}
    </div>
  );
}

export const DISCLAIMER =
  "Estimation indicative fondée sur les taux saisis dans l'application : ne constitue ni un conseil fiscal ni une garantie de conformité.";
