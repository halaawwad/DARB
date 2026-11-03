import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redis = createClient({
      url: env.redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 2000),
      },
    });

redis.on('error', (err: unknown) => {
    console.error('Redis client error', err);
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) {
    await redis.quit();
  }
}

export default redis;
