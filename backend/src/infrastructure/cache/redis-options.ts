import type { RedisOptions } from 'ioredis';
import config from '@/config';

export function getRedisConnectionOptions(): RedisOptions {
  if (config.redis.url) {
    const redisUrl = new URL(config.redis.url);

    return {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      username: redisUrl.username || undefined,
      password: redisUrl.password || config.redis.password || undefined,
      db: redisUrl.pathname ? Number(redisUrl.pathname.replace('/', '') || 0) : config.redis.db,
    };
  }

  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    db: config.redis.db,
    keyPrefix: config.redis.keyPrefix,
  };
}
