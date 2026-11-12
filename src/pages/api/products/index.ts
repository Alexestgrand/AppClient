import type { APIRoute } from 'astro';
import { handle, json, parseBody } from '@/lib/http';
import { productFilterSchema, productSchema } from '@/schemas/catalog';
import { productService } from '@/services/catalog.service';

export const GET: APIRoute = ({ url }) =>
  handle(async () =>
    json(
      await productService.list(productFilterSchema.parse(Object.fromEntries(url.searchParams))),
    ),
  );

export const POST: APIRoute = ({ request }) =>
  handle(async () =>
    json(await productService.create(await parseBody(request, productSchema)), 201),
  );
