/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig rend disponibles les modules virtuels d'Astro (middleware) et l'alias « @/ ».
export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests d'intégration partagent une base : exécution séquentielle.
    fileParallelism: false,
    setupFiles: ['tests/setup.ts'],
  },
});
