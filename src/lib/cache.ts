/**
 * Abstraction de cache clé/valeur avec expiration.
 * Implémentation en mémoire pour le MVP (une seule instance Node).
 * Pour passer à Redis : créer une classe implémentant `CacheStore` et l'exporter ici.
 */
export interface CacheStore {
  get(key: string): Promise<number | undefined>;
  increment(key: string, ttlMs: number): Promise<number>;
  delete(key: string): Promise<void>;
}

class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, { value: number; expiresAt: number }>();

  async get(key: string): Promise<number | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    await this.get(key); // purge l'entrée si elle a expiré
    const entry = this.entries.get(key);
    const next = {
      value: (entry?.value ?? 0) + 1,
      expiresAt: entry?.expiresAt ?? Date.now() + ttlMs,
    };
    this.entries.set(key, next);
    return next.value;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export const cache: CacheStore = new MemoryCacheStore();
