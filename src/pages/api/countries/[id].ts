import { itemRoutes } from '@/lib/crud';
import { countrySchema } from '@/schemas/catalog';
import { countryService } from '@/services/country.service';

export const { PUT, DELETE } = itemRoutes(countryService, countrySchema);
