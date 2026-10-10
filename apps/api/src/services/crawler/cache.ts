import { CrawlResult } from './index';

interface CacheEntry {
  result: CrawlResult;
  timestamp: number;
}

// 24 hours default in-memory cache TTL
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

class CrawlCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries = 500;

  private normalizeKey(urlOrDomain: string): string {
    return urlOrDomain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }

  get(urlOrDomain: string): CrawlResult | null {
    const key = this.normalizeKey(urlOrDomain);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > DEFAULT_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  set(urlOrDomain: string, result: CrawlResult): void {
    const key = this.normalizeKey(urlOrDomain);

    // Evict oldest if reaching capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  has(urlOrDomain: string): boolean {
    return this.get(urlOrDomain) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const crawlCache = new CrawlCache();
