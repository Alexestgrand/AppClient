import { itemRoutes } from '@/lib/crud';
import { warehouseSchema } from '@/schemas/catalog';
import { warehouseService } from '@/services/catalog.service';

export const { PUT, DELETE } = itemRoutes(warehouseService, warehouseSchema);
