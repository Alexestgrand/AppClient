import { collectionRoutes } from '@/lib/crud';
import { countrySchema } from '@/schemas/catalog';
import { countryService } from '@/services/country.service';

export const { GET, POST } = collectionRoutes(
  { list: () => countryService.list(), create: countryService.create },
  countrySchema,
);
