/**
 * Gestionnaire CRUD générique : liste, recherche/filtres, création, modification, suppression.
 * Toute la validation est refaite côté serveur ; le client ne fait qu'afficher les erreurs.
 */
import { useEffect, useMemo, useState, type SubmitEvent, type ReactNode } from 'react';
import { ApiError, apiFetch, errorMessage } from './api';
import { Alert, Field } from './ui';
import { useOpenOnNew } from './useOpenOnNew';

export type FormValues = Record<string, string | boolean>;

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'decimal' | 'select' | 'checkbox' | 'date';
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
}

export interface ColumnConfig<TRow> {
  header: string;
  render: (row: TRow) => ReactNode;
  className?: string;
}

export interface FilterConfig {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

interface Props<TRow extends { id: string }> {
  endpoint: string;
  entityLabel: string;
  initialRows: TRow[];
  columns: ColumnConfig<TRow>[];
  fields: FieldConfig[];
  toForm: (row: TRow | null) => FormValues;
  /** Filtres envoyés au serveur en paramètres d'URL (si absent : filtrage local du texte). */
  serverFilters?: FilterConfig[];
  searchPlaceholder?: string;
  localSearch?: (row: TRow) => string;
  /** Transformation optionnelle avant envoi (champs imbriqués…). */
  toBody?: (values: FormValues) => unknown;
  /** Ouvre le formulaire si la page est appelée avec ?new=1 (défaut : oui). */
  quickAdd?: boolean;
  extraForm?: (
    values: FormValues,
    setValues: (values: FormValues) => void,
    fieldErrors: Record<string, string[] | undefined>,
  ) => ReactNode;
}

export function EntityManager<TRow extends { id: string }>(props: Props<TRow>) {
  const {
    endpoint,
    entityLabel,
    columns,
    fields,
    toForm,
    serverFilters,
    localSearch,
    toBody,
    extraForm,
  } = props;
  const [rows, setRows] = useState<TRow[]>(props.initialRows);
  const [editing, setEditing] = useState<TRow | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [firstLoad, setFirstLoad] = useState(true);

  const reload = async () => {
    const params = new URLSearchParams();
    if (serverFilters) {
      if (search) params.set('search', search);
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    }
    setRows(await apiFetch<TRow[]>(`${endpoint}${params.size ? `?${params}` : ''}`));
  };

  // Recherche serveur (avec délai de frappe) uniquement si l'entité a des filtres serveur.
  useEffect(() => {
    if (!serverFilters) return;
    if (firstLoad) {
      setFirstLoad(false);
      return;
    }
    const timer = setTimeout(
      () => void reload().catch((e: unknown) => setError(errorMessage(e))),
      250,
    );
    return () => clearTimeout(timer);
  }, [search, filters]);

  const visibleRows = useMemo(() => {
    if (serverFilters || !localSearch || !search) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) => localSearch(row).toLowerCase().includes(needle));
  }, [rows, search, serverFilters, localSearch]);

  const openForm = (row: TRow | null) => {
    setEditing(row ?? 'new');
    setValues(toForm(row));
    setFieldErrors({});
    setError(null);
    setNotice(null);
  };

  useOpenOnNew(() => {
    if (props.quickAdd !== false) openForm(null);
  });

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body = toBody ? toBody(values) : values;
      if (editing === 'new') await apiFetch(endpoint, { method: 'POST', body });
      else if (editing) await apiFetch(`${endpoint}/${editing.id}`, { method: 'PUT', body });
      await reload();
      setNotice(editing === 'new' ? `${entityLabel} créé(e).` : `${entityLabel} modifié(e).`);
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: TRow) => {
    if (
      !window.confirm(
        `Supprimer cet élément (${entityLabel.toLowerCase()}) ? Cette action est définitive.`,
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`${endpoint}/${row.id}`, { method: 'DELETE' });
      setRows((current) => current.filter((item) => item.id !== row.id));
      setNotice(`${entityLabel} supprimé(e).`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const setValue = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {serverFilters || localSearch ? (
          <input
            className="input sm:max-w-xs"
            type="search"
            placeholder={props.searchPlaceholder ?? 'Rechercher…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher"
          />
        ) : null}
        {serverFilters?.map((filter) => (
          <select
            key={filter.name}
            className="input sm:max-w-xs"
            aria-label={filter.label}
            value={filters[filter.name] ?? ''}
            onChange={(e) =>
              setFilters((current) => ({ ...current, [filter.name]: e.target.value }))
            }
          >
            <option value="">{filter.label} : toutes</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <button type="button" className="btn btn-primary sm:ml-auto" onClick={() => openForm(null)}>
          + Ajouter
        </button>
      </div>

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error && !editing ? <Alert>{error}</Alert> : null}

      {editing ? (
        <form onSubmit={submit} className="card space-y-4" noValidate>
          <h2 className="text-lg font-semibold">
            {editing === 'new'
              ? `Nouveau / nouvelle : ${entityLabel.toLowerCase()}`
              : `Modifier : ${entityLabel.toLowerCase()}`}
          </h2>
          {error ? <Alert>{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input
                      type="checkbox"
                      checked={values[field.name] === true}
                      onChange={(e) => setValue(field.name, e.target.checked)}
                    />
                    {field.label}
                  </label>
                ) : (
                  <Field
                    label={`${field.label}${field.required ? ' *' : ''}`}
                    error={fieldErrors[field.name]}
                    {...(field.hint ? { hint: field.hint } : {})}
                  >
                    {field.type === 'textarea' ? (
                      <textarea
                        className="input"
                        rows={3}
                        value={String(values[field.name] ?? '')}
                        onChange={(e) => setValue(field.name, e.target.value)}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="input"
                        value={String(values[field.name] ?? '')}
                        onChange={(e) => setValue(field.name, e.target.value)}
                      >
                        <option value="">{field.required ? '— Choisir —' : '— Aucun —'}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input"
                        type={field.type === 'date' ? 'date' : 'text'}
                        inputMode={field.type === 'decimal' ? 'decimal' : undefined}
                        placeholder={field.placeholder}
                        value={String(values[field.name] ?? '')}
                        onChange={(e) => setValue(field.name, e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </div>
            ))}
          </div>
          {extraForm ? extraForm(values, setValues, fieldErrors) : null}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.header} className={column.className}>
                  {column.header}
                </th>
              ))}
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-6 text-center text-slate-600">
                  Aucun élément.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.header} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn mr-1 px-2 py-1"
                      onClick={() => openForm(row)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger px-2 py-1"
                      onClick={() => void remove(row)}
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
