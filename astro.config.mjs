// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  // La protection CSRF est assurée par src/middleware.ts (isAllowedOrigin), compatible reverse proxy.
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
});
