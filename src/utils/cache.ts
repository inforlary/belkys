interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class CacheManager {
  private storage: Storage;
  private prefix: string;

  constructor(useSessionStorage = false) {
    this.storage = useSessionStorage ? sessionStorage : localStorage;
    this.prefix = 'app_cache_';
  }

  set<T>(key: string, data: T, expiresInMinutes: number = 5): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiresIn: expiresInMinutes * 60 * 1000
      };
      this.storage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  get<T>(key: string): T | null {
    try {
      const itemStr = this.storage.getItem(this.prefix + key);
      if (!itemStr) return null;

      const item: CacheItem<T> = JSON.parse(itemStr);
      const now = Date.now();

      if (now - item.timestamp > item.expiresIn) {
        this.remove(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(this.storage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          this.storage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    expiresInMinutes: number = 5
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return fetchFn().then(data => {
      this.set(key, data, expiresInMinutes);
      return data;
    });
  }

  invalidatePattern(pattern: string): void {
    try {
      const keys = Object.keys(this.storage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix) && key.includes(pattern)) {
          this.storage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Cache invalidatePattern error:', error);
    }
  }
}

export const cache = new CacheManager(false);

export const sessionCache = new CacheManager(true);

export const useCachedData = <T>(
  key: string,
  fetchFn: () => Promise<T>,
  expiresInMinutes: number = 5,
  useSession: boolean = false
): Promise<T> => {
  const cacheInstance = useSession ? sessionCache : cache;
  return cacheInstance.getOrFetch(key, fetchFn, expiresInMinutes);
};

export const invalidateCache = (pattern?: string) => {
  if (pattern) {
    cache.invalidatePattern(pattern);
    sessionCache.invalidatePattern(pattern);
  } else {
    cache.clear();
    sessionCache.clear();
  }
};
