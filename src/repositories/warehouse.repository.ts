import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const warehouseRepository = {
  list: () =>
    prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        _count: { select: { products: true } },
      },
    }),
  findById: (id: string) => prisma.warehouse.findUnique({ where: { id } }),
  countProducts: (id: string) => prisma.product.count({ where: { warehouseId: id } }),
  create: (data: Prisma.WarehouseUncheckedCreateInput) => prisma.warehouse.create({ data }),
  update: (id: string, data: Prisma.WarehouseUncheckedUpdateInput) =>
    prisma.warehouse.update({ where: { id }, data }),
  delete: (id: string) => prisma.warehouse.delete({ where: { id } }),
  count: () => prisma.warehouse.count(),
};
