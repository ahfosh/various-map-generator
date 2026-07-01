class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private maxSize: number) { }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const COORD_CACHE_NEGATIVE = Symbol('coord-cache-negative')

type CoordinateLookupResult =
  | { type: 'miss' }
  | { type: 'negative' }
  | { type: 'positive'; panoId: string }

export function getCoordinateCacheKey(lng: number, lat: number, radiusMeters: number): string {
  const gridMeters = Math.max(radiusMeters, 50)
  const metersPerDegLat = 111320
  const latRad = (lat * Math.PI) / 180
  const gridDegLat = gridMeters / metersPerDegLat
  const gridDegLng = gridMeters / (metersPerDegLat * Math.cos(latRad))
  const gridLng = Math.round(lng / gridDegLng)
  const gridLat = Math.round(lat / gridDegLat)
  return `${gridLng}_${gridLat}_${radiusMeters}`
}

class CoordinateLookupCache {
  private cache = new LRUCache<string, string | typeof COORD_CACHE_NEGATIVE>(2000)

  lookup(key: string): CoordinateLookupResult {
    const entry = this.cache.get(key)
    if (entry === undefined) {
      return { type: 'miss' }
    }
    if (entry === COORD_CACHE_NEGATIVE) {
      return { type: 'negative' }
    }
    return { type: 'positive', panoId: entry }
  }

  setPositive(key: string, panoId: string): void {
    this.cache.set(key, panoId)
  }

  setNegative(key: string): void {
    this.cache.set(key, COORD_CACHE_NEGATIVE)
  }

  clear(): void {
    this.cache.clear()
  }
}

class CacheManager {
  private caches = new Map<string, LRUCache<string, any>>();
  private lastUsedProvider: string | null = null;
  private readonly panoCacheSize = 500

  getCache(provider: string): LRUCache<string, any> {
    if (!this.caches.has(provider)) {
      this.checkTotalCacheSize();
      this.caches.set(provider, new LRUCache(this.panoCacheSize));
    }
    this.lastUsedProvider = provider;
    return this.caches.get(provider)!;
  }

  get(provider: string, key: string): any {
    const cache = this.getCache(provider);
    return cache.get(key);
  }

  set(provider: string, key: string, value: any): void {
    const cache = this.getCache(provider);
    cache.set(key, value);
  }

  has(provider: string, key: string): boolean {
    const cache = this.getCache(provider);
    return cache.has(key);
  }

  private checkTotalCacheSize(): void {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.size;
    }
    if (total > 5000 && this.lastUsedProvider) {
      for (const [provider, cache] of this.caches.entries()) {
        if (provider !== this.lastUsedProvider) {
          cache.clear();
        }
      }
    }
  }
}

export const cacheManager = new CacheManager();
export const coordinateCache = new CoordinateLookupCache();