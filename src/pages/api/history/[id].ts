import type { APIRoute } from 'astro';
import { requireId } from '@/lib/crud';
import { handle, json } from '@/lib/http';
import { historyService } from '@/services/calculation.service';

export const GET: APIRoute = ({ params }) =>
  handle(async () => json(await historyService.get(requireId(params.id))));
export const DELETE: APIRoute = ({ params }) =>
  handle(async () => {
    await historyService.delete(requireId(params.id));
    return new Response(null, { status: 204 });
  });
