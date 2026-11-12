import type { APIRoute } from 'astro';
import { clearSessionCookie, deleteSession, SESSION_COOKIE } from '@/lib/session';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await deleteSession(cookies.get(SESSION_COOKIE)?.value);
  clearSessionCookie(cookies);
  return redirect('/login', 303);
};
