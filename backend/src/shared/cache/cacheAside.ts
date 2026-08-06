import { redisCache } from '@/infrastructure/cache/RedisCache';

/**
 * Task 2.1 (PERF-003): cache-aside for rarely-changing master data. Falls through
 * to the loader on a miss and on any Redis error (RedisCache swallows those and
 * returns null), so it degrades to a normal DB read — never a hard dependency.
 */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await redisCache.get<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  await redisCache.set(key, value, ttlSeconds);
  return value;
}

/** Invalidate exact keys (deterministic per resource — avoids KEYS/prefix issues). */
export async function invalidateKeys(...keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => redisCache.delete(k)));
}

/** hrms:cache:v1:<scope>:<resource> — keyPrefix (hrms:) is added by RedisCache. */
export function cacheKey(scope: string | undefined, resource: string): string {
  return `cache:v1:${scope ?? 'global'}:${resource}`;
}

export const CACHE_TTL = { static: 300 } as const; // 5 min for master data
