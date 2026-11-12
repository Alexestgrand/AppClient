import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db';
import { json } from '@/lib/http';

/** Sonde de santé (Docker / supervision) : vérifie l'accès à la base. */
export const GET: APIRoute = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'error' }, 503);
  }
};
