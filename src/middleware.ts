import { defineMiddleware } from 'astro:middleware';
import { isAllowedOrigin, isPublicPath, SECURITY_HEADERS } from './lib/route-guard';
import { SESSION_COOKIE, validateSession } from './lib/session';
import { json } from './lib/http';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!isAllowedOrigin(context.request)) {
    return json({ error: 'Requête refusée : origine non autorisée.' }, 403);
  }
  context.locals.user = await validateSession(context.cookies.get(SESSION_COOKIE)?.value);

  if (!context.locals.user && !isPublicPath(pathname)) {
    if (pathname.startsWith('/api/')) return json({ error: 'Authentification requise.' }, 401);
    return context.redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (context.locals.user && pathname === '/login') return context.redirect('/');

  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
});
