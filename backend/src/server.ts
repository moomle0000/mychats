import '@config';
import '@database';
import redis, { isRedisEnabled } from '@config/redis';
import { App } from './app';
import { appRoutes } from '@modules';
import { logger } from '@utils/logger';

const app = new App(appRoutes);

export const clearCacheOnStartup = async (): Promise<boolean> => {
  if (isRedisEnabled()) {
    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      await redis.flushdb();
      console.log('[Redis] Cache cleared on startup');
      return true;
    } catch (err: any) {
      console.warn('[Redis] Cache clear on startup skipped/failed: %s (continuing startup)', err?.message || err);
      return false;
    }
  }
  return false;
};

const startServer = async () => {
  await clearCacheOnStartup();
  app.listen();
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
