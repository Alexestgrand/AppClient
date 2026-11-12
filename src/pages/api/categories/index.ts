import { collectionRoutes } from '@/lib/crud';
import { categorySchema } from '@/schemas/catalog';
import { categoryService } from '@/services/catalog.service';

export const { GET, POST } = collectionRoutes(categoryService, categorySchema);
