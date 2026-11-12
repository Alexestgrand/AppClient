import type { APIRoute } from 'astro';
import { handle, json } from '@/lib/http';
import { parsePeriod } from '@/utils/period';
import { statsService } from '@/services/stats.service';

export const GET: APIRoute = ({ url }) =>
  handle(async () => json(await statsService.sales(parsePeriod(url.searchParams))));
