type CacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache: Record<string, CacheEntry<any>> = {}

export const cache = {
  get<T>(key: string): T | null {
    const entry = memoryCache[key]
    if (!entry) return null
    
    const isExpired = Date.now() - entry.timestamp > entry.ttl
    if (isExpired) {
      return null // Stale data, but can be used as fallback in SWR
    }
    return entry.data as T
  },

  getRaw<T>(key: string): T | null {
    const entry = memoryCache[key]
    return entry ? (entry.data as T) : null
  },

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    memoryCache[key] = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    }
  },

  invalidate(key: string): void {
    delete memoryCache[key]
  },

  clear(): void {
    Object.keys(memoryCache).forEach(key => delete memoryCache[key])
  }
}

export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate: (data: T) => void,
  ttlMs: number = 30000
): Promise<{ data: T | null; isStale: boolean }> {
  const cachedData = cache.get<T>(key)
  const rawData = cache.getRaw<T>(key)

  if (cachedData) {
    onUpdate(cachedData)
    return { data: cachedData, isStale: false }
  }

  // If there's stale data, call onUpdate with it immediately so UI renders instantly
  if (rawData) {
    onUpdate(rawData)
  }

  // Perform background fetch
  try {
    const freshData = await fetcher()
    cache.set(key, freshData, ttlMs)
    onUpdate(freshData)
    return { data: freshData, isStale: false }
  } catch (error) {
    console.error(`SWR fetch error for ${key}:`, error)
    // If background fetch fails but we had stale data, keep using it
    if (rawData) {
      return { data: rawData, isStale: true }
    }
    throw error
  }
}
