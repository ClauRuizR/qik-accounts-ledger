/**
 * Minimal key/value cache port. Implementations must *fail open*: when the
 * backing store is unavailable, `get` resolves to null and writes are no-ops,
 * so callers fall back to the source of truth (PostgreSQL).
 */
export abstract class CacheStore {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string, ttlSeconds: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  /** For health reporting only. */
  abstract isHealthy(): Promise<boolean>;
}
