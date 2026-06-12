interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  updatedAt: string;
}

export class MarketCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value as T;
  }

  getStale<T>(key: string): T | null {
    return (this.entries.get(key)?.value as T | undefined) ?? null;
  }

  set<T>(key: string, value: T, ttlMs: number): T {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      updatedAt: new Date().toISOString(),
    });

    return value;
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) return cached;

    const value = await loader();
    return this.set(key, value, ttlMs);
  }

  clear() {
    this.entries.clear();
  }
}

export const marketCache = new MarketCache();
