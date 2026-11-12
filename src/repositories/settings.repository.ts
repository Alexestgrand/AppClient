import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const settingsRepository = {
  getOrCreate: () => prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  update: (data: Prisma.AppSettingsUpdateInput) =>
    prisma.appSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...(data as Prisma.AppSettingsCreateInput) },
    }),
};
