/**
 * Fabrique de routes API CRUD : authentification (middleware) → validation Zod → service.
 * Évite de dupliquer la même plomberie pour chaque entité.
 */
import type { APIRoute } from 'astro';
import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from './errors';
import { handle, json, parseBody } from './http';

interface CollectionService<TInput> {
  list(): Promise<unknown>;
  create(input: TInput): Promise<unknown>;
}

interface ItemService<TInput> {
  update(id: string, input: TInput): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

export function collectionRoutes<TInput>(
  service: CollectionService<TInput>,
  schema: ZodType<TInput, ZodTypeDef, unknown>,
) {
  const GET: APIRoute = () => handle(async () => json(await service.list()));
  const POST: APIRoute = ({ request }) =>
    handle(async () => json(await service.create(await parseBody(request, schema)), 201));
  return { GET, POST };
}

export function requireId(id: string | undefined): string {
  if (!id) throw new AppError('Identifiant manquant.', 400);
  return id;
}

export function itemRoutes<TInput>(
  service: ItemService<TInput>,
  schema: ZodType<TInput, ZodTypeDef, unknown>,
) {
  const PUT: APIRoute = ({ params, request }) =>
    handle(async () =>
      json(await service.update(requireId(params.id), await parseBody(request, schema))),
    );
  const DELETE: APIRoute = ({ params }) =>
    handle(async () => {
      await service.delete(requireId(params.id));
      return new Response(null, { status: 204 });
    });
  return { PUT, DELETE };
}
