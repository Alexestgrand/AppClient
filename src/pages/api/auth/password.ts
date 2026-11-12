import type { APIRoute } from 'astro';
import { AppError } from '@/lib/errors';
import { handle, json, parseBody } from '@/lib/http';
import { changePasswordSchema } from '@/schemas/auth';
import { authService } from '@/services/auth.service';

export const POST: APIRoute = ({ request, locals }) =>
  handle(async () => {
    if (!locals.user) throw new AppError('Authentification requise.', 401);
    const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema);
    await authService.changePassword(locals.user.id, currentPassword, newPassword);
    return json({ ok: true });
  });
