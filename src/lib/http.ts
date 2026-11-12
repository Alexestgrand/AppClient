/** Aides pour les routes API : réponses JSON homogènes et gestion centralisée des erreurs. */
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { AppError } from './errors';
import { logger } from './logger';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('Corps de requête JSON invalide.');
  }
  return schema.parse(body);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return json({ error: 'Données invalides.', fieldErrors: error.flatten().fieldErrors }, 400);
  }
  if (error instanceof AppError) {
    return json({ error: error.message, fieldErrors: error.fieldErrors }, error.status);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return json({ error: 'Cette valeur existe déjà (doublon).' }, 409);
    if (error.code === 'P2003') {
      return json({ error: 'Opération impossible : cet élément est utilisé ailleurs.' }, 409);
    }
    if (error.code === 'P2025') return json({ error: 'Élément introuvable.' }, 404);
  }
  logger.error('Erreur serveur non gérée', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  });
  return json({ error: 'Erreur interne du serveur.' }, 500);
}

/** Enveloppe un handler API : toute exception est convertie en réponse propre. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch(errorResponse);
}
