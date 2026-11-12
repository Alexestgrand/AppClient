import type { APIRoute } from 'astro';
import { requireId } from '@/lib/crud';
import { handle } from '@/lib/http';
import { saleService } from '@/services/sale.service';

export const DELETE: APIRoute = ({ params }) =>
  handle(async () => {
    await saleService.delete(requireId(params.id));
    return new Response(null, { status: 204 });
  });
