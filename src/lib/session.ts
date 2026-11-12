import { createHash, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { prisma } from './db';

export const SESSION_COOKIE = 'tva_session';

function ttlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600 * 1000;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string;
}

/** Crée une session et renvoie le jeton brut (à placer dans le cookie, jamais stocké en base). */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMs());
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  // Nettoyage opportuniste des sessions expirées.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, expiresAt };
}

/** Valide un jeton ; prolonge la session (expiration glissante). */
export async function validateSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // On ne réécrit la session qu'au-delà de 5 minutes d'inactivité pour limiter les écritures.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + ttlMs()) },
    });
  }
  return session.user;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function setSessionCookie(cookies: AstroCookies, token: string, expiresAt: Date): void {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
