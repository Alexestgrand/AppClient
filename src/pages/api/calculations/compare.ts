import type { APIRoute } from 'astro';
import { handle, json, parseBody } from '@/lib/http';
import { comparisonSchema } from '@/schemas/calculation';
import { calculationService } from '@/services/calculation.service';

export const POST: APIRoute = ({ request }) =>
  handle(async () =>
    json(await calculationService.compare(await parseBody(request, comparisonSchema))),
  );
