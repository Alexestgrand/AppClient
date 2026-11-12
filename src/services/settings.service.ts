import type { z } from 'zod';
import type { settingsSchema } from '@/schemas/catalog';
import { settingsRepository } from '@/repositories/settings.repository';

export const settingsService = {
  get: () => settingsRepository.getOrCreate(),
  update: (input: z.infer<typeof settingsSchema>) => settingsRepository.update(input),
};
