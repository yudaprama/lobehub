import Redis from 'ioredis';

let redis: Redis | null = null;

export const getRedis = () => {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL is not set. Redis features will be disabled.');
      return null;
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });

    redis.on('connect', () => {
      console.info('✅ Redis connected');
    });
  }

  return redis;
};

export type RedisClient = Redis | null;
