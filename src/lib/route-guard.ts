/** Règles d'accès : tout est privé sauf la page de connexion et les ressources statiques. */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/health']);

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) || pathname.startsWith('/_astro/') || pathname === '/favicon.svg'
  );
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Astro injecte des scripts inline pour l'hydratation des îlots React.
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF : toute requête modifiante doit provenir de la même origine.
 * L'origine attendue est APP_ORIGIN si défini (recommandé en production derrière un
 * reverse proxy), sinon l'hôte de la requête (en-tête Host / X-Forwarded-Host).
 * Complète le cookie de session SameSite=Lax.
 */
export function isAllowedOrigin(request: Request, appOrigin = process.env.APP_ORIGIN): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (!source) return false;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return false;
  }
  if (appOrigin) return sourceUrl.origin === new URL(appOrigin).origin;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return host !== null && sourceUrl.host === host;
}
