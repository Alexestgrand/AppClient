import { collectionRoutes } from '@/lib/crud';
import { exchangeRateSchema } from '@/schemas/catalog';
import { exchangeRateService } from '@/services/country.service';

/** POST crée ou met à jour le taux de la devise (unique par devise). */
export const { GET, POST } = collectionRoutes(
  { list: exchangeRateService.list, create: exchangeRateService.upsert },
  exchangeRateSchema,
);
