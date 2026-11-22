import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const isTest = process.env.NODE_ENV === 'test';

    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: isTest ? 0 : null,
      enableReadyCheck: false,
      lazyConnect: true,
      enableOfflineQueue: !isTest,
      retryStrategy: (times) => {
        if (isTest) return null; // Do not endlessly retry during test runs
        return Math.min(times * 200, 5000);
      },
    });

    redisClient.on('error', (err) => {
      // Silence expected connection errors during unit/integration tests
      if (!isTest) {
        console.warn('[Redis] Connection warning:', err.message);
      }
    });

    redisClient.on('connect', () => {
      if (!isTest) {
        console.log('[Redis] Connected to Redis broker at', config.redisUrl);
      }
    });
  }

  return redisClient;
};

export default getRedisClient;
