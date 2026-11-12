import { itemRoutes } from '@/lib/crud';
import { categorySchema } from '@/schemas/catalog';
import { categoryService } from '@/services/catalog.service';

export const { PUT, DELETE } = itemRoutes(categoryService, categorySchema);
