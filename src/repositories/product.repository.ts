import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface ProductFilter {
  search?: string | undefined;
  categoryId?: string | undefined;
  warehouseId?: string | undefined;
}

const include = {
  category: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export const productRepository = {
  list: ({ search, categoryId, warehouseId }: ProductFilter) =>
    prisma.product.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { reference: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include,
      orderBy: { name: 'asc' },
      take: 500,
    }),
  findById: (id: string) => prisma.product.findUnique({ where: { id }, include }),
  create: (data: Prisma.ProductUncheckedCreateInput) => prisma.product.create({ data, include }),
  update: (id: string, data: Prisma.ProductUncheckedUpdateInput) =>
    prisma.product.update({ where: { id }, data, include }),
  delete: (id: string) => prisma.product.delete({ where: { id } }),
  count: () => prisma.product.count(),
};
