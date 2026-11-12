import type { APIRoute } from 'astro';
import { z } from 'zod';
import { handle, json, parseBody } from '@/lib/http';
import {
  historyFilterSchema,
  internationalCalculationSchema,
  vatCalculationSchema,
} from '@/schemas/calculation';
import { calculationService, historyService } from '@/services/calculation.service';

export const GET: APIRoute = ({ url }) =>
  handle(async () =>
    json(
      await historyService.list(historyFilterSchema.parse(Object.fromEntries(url.searchParams))),
    ),
  );

/** Enregistre un calcul : le serveur RECALCULE à partir des entrées (aucun résultat client n'est cru). */
const saveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('VAT'), input: vatCalculationSchema }),
  z.object({ kind: z.literal('INTERNATIONAL'), input: internationalCalculationSchema }),
]);

export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const body = await parseBody(request, saveSchema);
    const saved =
      body.kind === 'VAT'
        ? await calculationService.saveVat(body.input)
        : await calculationService.saveInternational(body.input);
    return json(saved, 201);
  });
