import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const categoryRepository = {
  list: () =>
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
  findById: (id: string) => prisma.category.findUnique({ where: { id } }),
  countProducts: (id: string) => prisma.product.count({ where: { categoryId: id } }),
  create: (data: Prisma.CategoryCreateInput) => prisma.category.create({ data }),
  update: (id: string, data: Prisma.CategoryUpdateInput) =>
    prisma.category.update({ where: { id }, data }),
  delete: (id: string) => prisma.category.delete({ where: { id } }),
  count: () => prisma.category.count(),
};
