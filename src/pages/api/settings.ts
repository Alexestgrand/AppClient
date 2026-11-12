import type { APIRoute } from 'astro';
import { handle, json, parseBody } from '@/lib/http';
import { settingsSchema } from '@/schemas/catalog';
import { settingsService } from '@/services/settings.service';

export const GET: APIRoute = () => handle(async () => json(await settingsService.get()));
export const PUT: APIRoute = ({ request }) =>
  handle(async () => json(await settingsService.update(await parseBody(request, settingsSchema))));
