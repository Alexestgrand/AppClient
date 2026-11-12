import { useState, type SubmitEvent } from 'react';
import { apiFetch, errorMessage } from './api';
import { Alert, Field } from './ui';

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
      // Redirection uniquement vers un chemin interne (pas de redirection ouverte).
      window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <form className="card w-full max-w-sm space-y-4" onSubmit={submit}>
      <h1 className="text-xl font-bold">Connexion</h1>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Email">
        <input
          className="input"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Mot de passe">
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <button className="btn btn-primary w-full" type="submit" disabled={busy}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
