import { cache, type CacheStore } from './cache';

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Limitation des tentatives de connexion par clé (IP + email). */
export function createLoginRateLimiter(store: CacheStore = cache) {
  const key = (id: string) => `login:${id}`;
  return {
    async isBlocked(id: string): Promise<boolean> {
      return ((await store.get(key(id))) ?? 0) >= LOGIN_MAX_ATTEMPTS;
    },
    async registerFailure(id: string): Promise<void> {
      await store.increment(key(id), LOGIN_WINDOW_MS);
    },
    async reset(id: string): Promise<void> {
      await store.delete(key(id));
    },
  };
}

export const loginRateLimiter = createLoginRateLimiter();
