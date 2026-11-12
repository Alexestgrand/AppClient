import type { APIRoute } from 'astro';
import { handle, json, parseBody } from '@/lib/http';
import { setSessionCookie } from '@/lib/session';
import { loginSchema } from '@/schemas/auth';
import { authService } from '@/services/auth.service';

export const POST: APIRoute = ({ request, cookies, clientAddress }) =>
  handle(async () => {
    const { email, password } = await parseBody(request, loginSchema);
    const { token, expiresAt } = await authService.login(email, password, clientAddress);
    setSessionCookie(cookies, token, expiresAt);
    return json({ ok: true });
  });
