import type { APIRoute } from 'astro';
import { handle, json, parseBody } from '@/lib/http';
import { parsePeriod } from '@/utils/period';
import { saleSchema } from '@/schemas/sale';
import { saleService } from '@/services/sale.service';

export const GET: APIRoute = ({ url }) =>
  handle(async () => json(await saleService.list(parsePeriod(url.searchParams))));
export const POST: APIRoute = ({ request }) =>
  handle(async () => json(await saleService.create(await parseBody(request, saleSchema)), 201));
