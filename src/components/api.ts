/** Client HTTP du navigateur : JSON, gestion uniforme des erreurs de l'API. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? null : JSON.stringify(options.body),
    credentials: 'same-origin',
  });
  if (response.status === 401 && !url.startsWith('/api/auth/')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError('Session expirée.', 401);
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as { error?: string; fieldErrors?: Record<string, string[]> };
    throw new ApiError(
      payload.error ?? 'Erreur inattendue.',
      response.status,
      payload.fieldErrors ?? {},
    );
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inattendue.';
}
