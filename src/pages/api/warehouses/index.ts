import { collectionRoutes } from '@/lib/crud';
import { warehouseSchema } from '@/schemas/catalog';
import { warehouseService } from '@/services/catalog.service';

export const { GET, POST } = collectionRoutes(warehouseService, warehouseSchema);
