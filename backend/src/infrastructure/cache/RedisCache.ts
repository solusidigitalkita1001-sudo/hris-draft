import Redis from 'ioredis';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { getRedisConnectionOptions } from './redis-options';

export class RedisCache {
  private static instance: RedisCache;
  private client: Redis;
  private readonly defaultTTL: number = 3600; // 1 hour
  private readonly healthTimeoutMs: number = 1000;

  private constructor() {
    const redisOptions = getRedisConnectionOptions();

    this.client = new Redis({
      ...redisOptions,
      keyPrefix: config.redis.keyPrefix,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => {
      logger.info('Redis cache connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis cache error', { error: error.message });
    });
  }

  static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTTL;
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      logger.error('Redis set error', { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis delete error', { key, error });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error('Redis delete pattern error', { pattern, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Cache-aside pattern: get from cache or set from factory function
   */
  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidate cache keys matching patterns for an entity
   */
  async invalidateEntity(entity: string, entityId: string): Promise<void> {
    await this.deletePattern(`cache:${entity}:${entityId}:*`);
    await this.deletePattern(`cache:${entity}:list:*`);
  }

  /**
   * Add token to blacklist
   */
  async blacklistToken(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.client.setex(`blacklist:${jti}`, ttl, '1');
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:${jti}`);
    return result === '1';
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const value = await this.client.incr(key);
    if (ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  async getTTL(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info('Redis cache disconnected');
  }

  async ping(): Promise<boolean> {
    try {
      const response = await Promise.race([
        this.client.ping(),
        new Promise<'TIMEOUT'>((resolve) =>
          setTimeout(() => resolve('TIMEOUT'), this.healthTimeoutMs)
        ),
      ]);
      return response === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisCache = RedisCache.getInstance();
