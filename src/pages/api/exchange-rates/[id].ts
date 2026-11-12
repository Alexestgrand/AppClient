import { itemRoutes } from '@/lib/crud';
import { exchangeRateSchema } from '@/schemas/catalog';
import { exchangeRateService } from '@/services/country.service';

export const { PUT, DELETE } = itemRoutes(exchangeRateService, exchangeRateSchema);
