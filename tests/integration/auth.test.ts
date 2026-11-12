import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { onRequest } from '@/middleware';
import { prisma } from '@/lib/db';
import { createLoginRateLimiter, LOGIN_MAX_ATTEMPTS } from '@/lib/rate-limit';
import { isAllowedOrigin, isPublicPath } from '@/lib/route-guard';
import { SESSION_COOKIE, validateSession } from '@/lib/session';
import { authService } from '@/services/auth.service';
import { hasTestDatabase, resetDatabase } from './helpers';

/** Contexte minimal pour exécuter le middleware Astro hors serveur. */
function fakeContext(
  path: string,
  options: { method?: string; token?: string; origin?: string } = {},
) {
  const url = new URL(`http://localhost:4321${path}`);
  const headers = new Headers({ host: 'localhost:4321' });
  if (options.origin) headers.set('origin', options.origin);
  return {
    url,
    request: new Request(url, { method: options.method ?? 'GET', headers }),
    locals: {} as App.Locals,
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE && options.token ? { value: options.token } : undefined,
    },
    redirect: (location: string) =>
      new Response(null, { status: 302, headers: { Location: location } }),
  };
}

type Middleware = (context: unknown, next: () => Promise<Response>) => Promise<Response>;
const run = (context: ReturnType<typeof fakeContext>) =>
  (onRequest as unknown as Middleware)(context, async () => new Response('ok'));

describe('règles de routage', () => {
  it('seules la connexion et les ressources statiques sont publiques', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/api/auth/login')).toBe(true);
    expect(isPublicPath('/_astro/app.js')).toBe(true);
    for (const path of [
      '/',
      '/products',
      '/api/products',
      '/api/history',
      '/api/auth/password',
      '/api/settings',
    ]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it('bloque les requêtes modifiantes d’une autre origine (CSRF)', () => {
    const request = (origin: string | null, method = 'POST') =>
      new Request('http://localhost:4321/api/products', {
        method,
        headers: { host: 'localhost:4321', ...(origin ? { origin } : {}) },
      });
    expect(isAllowedOrigin(request('http://localhost:4321'))).toBe(true);
    expect(isAllowedOrigin(request('https://malveillant.example'))).toBe(false);
    expect(isAllowedOrigin(request(null))).toBe(false);
    expect(isAllowedOrigin(request(null, 'GET'))).toBe(true);
    expect(isAllowedOrigin(request('https://tva.example.com'), 'https://tva.example.com')).toBe(
      true,
    );
  });

  it('limite les tentatives de connexion', async () => {
    const limiter = createLoginRateLimiter();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) await limiter.registerFailure('ip:x');
    expect(await limiter.isBlocked('ip:x')).toBe(true);
    await limiter.reset('ip:x');
    expect(await limiter.isBlocked('ip:x')).toBe(false);
  });
});

describe.skipIf(!hasTestDatabase)('accès aux routes protégées', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('refuse l’accès sans session (401 API, redirection page)', async () => {
    expect((await run(fakeContext('/api/products'))).status).toBe(401);
    const page = await run(fakeContext('/products'));
    expect(page.status).toBe(302);
    expect(page.headers.get('Location')).toBe('/login?next=%2Fproducts');
    expect((await run(fakeContext('/api/products', { token: 'jeton-invalide' }))).status).toBe(401);
  });

  it('autorise l’accès avec une session valide et ajoute les en-têtes de sécurité', async () => {
    await authService.upsertAdmin('admin@test.fr', 'mot-de-passe-solide');
    const { token } = await authService.login('admin@test.fr', 'mot-de-passe-solide', 'test');
    const response = await run(fakeContext('/api/products', { token }));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect((await validateSession(token))?.email).toBe('admin@test.fr');
  });

  it('refuse un mauvais mot de passe puis bloque après trop d’échecs', async () => {
    await authService.upsertAdmin('admin@test.fr', 'mot-de-passe-solide');
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await expect(authService.login('admin@test.fr', 'faux', 'ip-1')).rejects.toMatchObject({
        status: 401,
      });
    }
    await expect(
      authService.login('admin@test.fr', 'mot-de-passe-solide', 'ip-1'),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('stocke un hash Argon2id et jamais le mot de passe', async () => {
    const user = await authService.upsertAdmin('admin@test.fr', 'mot-de-passe-solide');
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain('mot-de-passe-solide');
  });

  it('refuse une requête POST d’une autre origine', async () => {
    const response = await run(
      fakeContext('/api/categories', { method: 'POST', origin: 'https://malveillant.example' }),
    );
    expect(response.status).toBe(403);
  });
});
