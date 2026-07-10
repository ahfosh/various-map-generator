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
  /** Larger capacity: checkAllDates fans out many timeline sdata hits per seed point. */
  private readonly panoCacheSize = 2000

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
    if (total > 8000 && this.lastUsedProvider) {
      for (const [provider, cache] of this.caches.entries()) {
        if (provider !== this.lastUsedProvider) {
          cache.clear();
        }
      }
    }
  }
}

export type PanoDateMeta = {
  /** Capture / image date (ISO-ish) */
  imageDate?: string
  /** Publish / procdate (ISO-ish) */
  procDate?: string
  /** Epoch ms when written */
  ts: number
}

const PANO_DATE_META_KEY = 'map_generator__pano_date_meta_v1'
const PANO_DATE_META_MAX = 8000
/** procdate can be rewritten by Baidu reprocessing; avoid permanent false rejects */
const PANO_DATE_META_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Persistent panoId → capture/publish dates for cross-session timeline pruning.
 * Used only to *reject* (skip network); never to accept without a full fetch.
 */
class PanoDateMetaCache {
  private map = new Map<string, PanoDateMeta>()
  private loaded = false
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  private ensureLoaded() {
    if (this.loaded) return
    this.loaded = true
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(PANO_DATE_META_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, PanoDateMeta>
      const now = Date.now()
      for (const [id, meta] of Object.entries(parsed)) {
        if (!meta || typeof meta !== 'object') continue
        if (typeof meta.ts !== 'number' || now - meta.ts > PANO_DATE_META_TTL_MS) continue
        this.map.set(id, meta)
      }
    } catch {
      // ignore corrupt storage
    }
  }

  get(panoId: string): PanoDateMeta | undefined {
    this.ensureLoaded()
    const meta = this.map.get(panoId)
    if (!meta) return undefined
    if (Date.now() - meta.ts > PANO_DATE_META_TTL_MS) {
      this.map.delete(panoId)
      this.schedulePersist()
      return undefined
    }
    // LRU touch
    this.map.delete(panoId)
    this.map.set(panoId, meta)
    return meta
  }

  set(panoId: string, imageDate?: string, procDate?: string) {
    if (!panoId) return
    if (!imageDate && !procDate) return
    this.ensureLoaded()
    if (this.map.has(panoId)) this.map.delete(panoId)
    this.map.set(panoId, { imageDate, procDate, ts: Date.now() })
    while (this.map.size > PANO_DATE_META_MAX) {
      const first = this.map.keys().next().value
      if (first === undefined) break
      this.map.delete(first)
    }
    this.schedulePersist()
  }

  private schedulePersist() {
    if (typeof localStorage === 'undefined') return
    if (this.persistTimer != null) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persist()
    }, 400)
  }

  private persist() {
    if (typeof localStorage === 'undefined') return
    try {
      const obj: Record<string, PanoDateMeta> = {}
      for (const [id, meta] of this.map) {
        obj[id] = meta
      }
      localStorage.setItem(PANO_DATE_META_KEY, JSON.stringify(obj))
    } catch {
      // quota / private mode
    }
  }
}

export const cacheManager = new CacheManager();
export const coordinateCache = new CoordinateLookupCache();
export const panoDateMetaCache = new PanoDateMetaCache();