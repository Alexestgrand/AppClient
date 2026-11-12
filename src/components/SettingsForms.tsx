import { useState, type SubmitEvent } from 'react';
import { ApiError, apiFetch, errorMessage } from './api';
import { Alert, Field } from './ui';

interface Props {
  settings: { companyName: string; mainCurrency: string; defaultTargetAmount: string };
  email: string;
}

type Status = { kind: 'success' | 'error'; text: string } | null;

export default function SettingsForms({ settings, email }: Props) {
  const [values, setValues] = useState({
    ...settings,
    defaultTargetAmount: String(Number(settings.defaultTargetAmount)),
  });
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [pwErrors, setPwErrors] = useState<Record<string, string[] | undefined>>({});

  const saveSettings = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setErrors({});
    try {
      await apiFetch('/api/settings', { method: 'PUT', body: values });
      setStatus({ kind: 'success', text: 'Paramètres enregistrés.' });
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) });
      if (e instanceof ApiError) setErrors(e.fieldErrors);
    }
  };

  const changePassword = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwStatus(null);
    setPwErrors({});
    if (passwords.newPassword !== passwords.confirm) {
      setPwErrors({ confirm: ['Les deux mots de passe ne correspondent pas.'] });
      return;
    }
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword },
      });
      setPwStatus({ kind: 'success', text: 'Mot de passe modifié.' });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setPwStatus({ kind: 'error', text: errorMessage(e) });
      if (e instanceof ApiError) setPwErrors(e.fieldErrors);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="card space-y-4" onSubmit={saveSettings} noValidate>
        <h2 className="text-lg font-semibold">Paramètres généraux</h2>
        {status ? <Alert kind={status.kind}>{status.text}</Alert> : null}
        <Field label="Nom de l’entreprise" error={errors.companyName}>
          <input
            className="input"
            value={values.companyName}
            onChange={(e) => setValues({ ...values, companyName: e.target.value })}
          />
        </Field>
        <Field
          label="Devise principale (ISO 4217)"
          error={errors.mainCurrency}
          hint="Devise des coûts, objectifs et statistiques. Les taux de change sont exprimés par rapport à elle."
        >
          <input
            className="input"
            value={values.mainCurrency}
            onChange={(e) => setValues({ ...values, mainCurrency: e.target.value })}
          />
        </Field>
        <Field
          label="Objectif financier par défaut (par produit)"
          error={errors.defaultTargetAmount}
        >
          <input
            className="input"
            inputMode="decimal"
            value={values.defaultTargetAmount}
            onChange={(e) => setValues({ ...values, defaultTargetAmount: e.target.value })}
          />
        </Field>
        <button className="btn btn-primary" type="submit">
          Enregistrer
        </button>
      </form>

      <form className="card space-y-4" onSubmit={changePassword} noValidate>
        <h2 className="text-lg font-semibold">Compte</h2>
        <p className="text-sm text-slate-600">
          Connecté en tant que <strong>{email}</strong> (administrateur unique).
        </p>
        {pwStatus ? <Alert kind={pwStatus.kind}>{pwStatus.text}</Alert> : null}
        <Field label="Mot de passe actuel" error={pwErrors.currentPassword}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          />
        </Field>
        <Field label="Nouveau mot de passe (12 caractères min.)" error={pwErrors.newPassword}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          />
        </Field>
        <Field label="Confirmation" error={pwErrors.confirm}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
          />
        </Field>
        <button className="btn btn-primary" type="submit">
          Changer le mot de passe
        </button>
      </form>
    </div>
  );
}
