# --- Étape 1 : dépendances + build ---
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && apt-get clean \
  && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate && pnpm exec astro build

# --- Étape 2 : image d'exécution ---
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && apt-get clean \
  && corepack enable
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
# node_modules complet : nécessaire pour les migrations (Prisma CLI), le seed et `admin:create` (tsx).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json /app/tsconfig.json ./
RUN chown -R node:node /app
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4321/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applique les migrations en attente puis démarre le serveur.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/server/entry.mjs"]
