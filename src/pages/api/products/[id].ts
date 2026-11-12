import type { APIRoute } from 'astro';
import { itemRoutes, requireId } from '@/lib/crud';
import { handle, json } from '@/lib/http';
import { productSchema } from '@/schemas/catalog';
import { productService } from '@/services/catalog.service';

export const GET: APIRoute = ({ params }) =>
  handle(async () => json(await productService.get(requireId(params.id))));
export const { PUT, DELETE } = itemRoutes(productService, productSchema);
