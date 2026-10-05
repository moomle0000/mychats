import { config } from 'dotenv';
import path from 'path';

// Load base .env first, then local override
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}.local`), override: true });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || '5223';
export const SECRET_KEY = process.env.SECRET_KEY || 'chatSSE-super-secret-key-2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
export const LOG_FORMAT = process.env.LOG_FORMAT || 'dev';
export const LOG_DIR = process.env.LOG_DIR || 'logs';
export const ORIGIN = process.env.ORIGIN || '*';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
export const JWT_COOKIE_SECURE = process.env.JWT_COOKIE_SECURE === 'true';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const AI_API_URL = process.env.AI_API_URL || 'https://myai.lmstream.xyz/v1';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://192.168.0.12:27017/chatSSE';
}
export const MONGODB_URI = process.env.MONGODB_URI;
export const REDIS_URL = process.env.REDIS_URL || 'redis://192.168.0.12:6379';
export const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false' && process.env.CACHE_ENABLED !== 'false';
export const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false' && process.env.REDIS_ENABLED !== 'false';
export const REDIS_TTL = parseInt(process.env.REDIS_TTL || '600', 10);
export const REDIS_PREFIX = process.env.REDIS_PREFIX || 'chatSSE:';

export { default as redis, isRedisEnabled } from './redis';

export const IMAGE_STORAGE_PATH = 'uploads/images';
export const IMAGE_MAX_SIZE = 80 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const DOCUMENT_STORAGE_PATH = 'uploads/documents';
export const DOCUMENT_MAX_SIZE = 100 * 1024 * 1024;
export const FILE_STORAGE_PATH = 'uploads/files';
export const MAX_FILE_SIZE = 50 * 1024 * 1024;