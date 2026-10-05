import Redis from 'ioredis';

export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== 'false' && process.env.CACHE_ENABLED !== 'false';
}

const redisUrl = process.env.REDIS_URL || 'redis://192.168.0.12:6379';

const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    if (!isRedisEnabled()) return null;
    const delay = Math.min(times * 200, 5000);
    if (times > 5) {
      console.warn(`[Redis] Failed to connect after ${times} retries. Falling back to DB.`);
      return null;
    }
    return delay;
  },
  maxRetriesPerRequest: 1,
  commandTimeout: 2000,
  connectTimeout: 3000,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('connect', () => {
  if (isRedisEnabled()) {
    console.log('[Redis] Connecting...');
  }
});

redis.on('ready', () => {
  console.log('[Redis] Connected and ready ✅');
});

redis.on('error', err => {
  if (isRedisEnabled()) {
    console.warn('[Redis] Connection error: %s (fallback to DB active)', err.message);
  }
});

redis.on('close', () => {
  if (isRedisEnabled()) {
    console.warn('[Redis] Connection closed');
  }
});

redis.on('reconnecting', () => {
  if (isRedisEnabled()) {
    console.log('[Redis] Reconnecting...');
  }
});

// Auto-connect ONLY if REDIS_ENABLED is active
if (isRedisEnabled()) {
  redis.connect().catch(err => {
    console.warn('[Redis] Initial connection deferred or failed: %s (fallback to DB active)', err.message);
  });
}

export default redis;