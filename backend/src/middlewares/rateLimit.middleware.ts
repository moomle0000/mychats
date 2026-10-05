import { NextFunction, Request, Response } from 'express';
import { decode } from 'jsonwebtoken';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class InMemoryTokenBucketLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly capacity: number;
  private readonly refillPerSec: number;

  constructor(capacity = 3000, refillPerSec = 50, cleanupIntervalMs = 60000) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;

    // Automatic garbage collection of idle buckets to strictly bound RAM usage
    const timer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (timer.unref) timer.unref();
  }

  public consume(key: string, cost = 1): { allowed: boolean; remaining: number; resetSec: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSec);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      const remaining = Math.floor(bucket.tokens);
      return { allowed: true, remaining, resetSec: 1 };
    }

    const tokensNeeded = cost - bucket.tokens;
    const resetSec = Math.ceil(tokensNeeded / this.refillPerSec);
    return { allowed: false, remaining: 0, resetSec };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      // Evict entries that have been at full capacity for over 5 minutes
      if (now - bucket.lastRefill > 300000 && bucket.tokens >= this.capacity) {
        this.buckets.delete(key);
      }
    }
  }

  public size(): number {
    return this.buckets.size;
  }
}

// 1. Tenant-level limiter: 10,000 capacity, 200 tokens/sec refill (~12,000 req/min)
const tenantLimiter = new InMemoryTokenBucketLimiter(10000, 200);

// 2. User-level limiter: 2,000 capacity, 50 tokens/sec refill (~3,000 req/min)
const userLimiter = new InMemoryTokenBucketLimiter(2000, 50);

// 3. Sensitive public auth route limiter (login/password reset): 60 capacity, 1 token/sec (~60 req/min)
const publicAuthLimiter = new InMemoryTokenBucketLimiter(60, 1);

export const RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // In development, skip rate limiting so local dev, hot-reloading, and UI testing are never throttled
  if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }

  // Skip rate limiting for static assets and swagger
  const path = req.path || '';
  if (
    path.startsWith('/uploads') ||
    path.startsWith('/img') ||
    path.startsWith('/files') ||
    path.startsWith('/api-docs')
  ) {
    return next();
  }

  const tenant = (req as any).tenant;
  const authHeader = req.header('Authorization') || req.cookies?.Authorization;
  let userId: string | null = null;

  if (authHeader) {
    try {
      const rawToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : authHeader;
      const decoded: any = decode(rawToken);
      if (decoded?.id) userId = decoded.id;
    } catch {}
  }

  // 1. Check Tenant-Level Quota (Solves the "Noisy Neighbor" problem across s)
  if (tenant?.tenantId) {
    const result = tenantLimiter.consume(`tenant:${tenant.tenantId}`);
    res.setHeader('X-RateLimit-Limit', '3000');
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSec.toString());
      return res.status(429).json({
        message: ' institution API capacity threshold reached. Please throttle concurrent requests.',
        scope: 'tenant',
        retryAfterSeconds: result.resetSec,
      });
    }
  }

  // 2. Check User-Level Quota (Prevents a single rogue script from starving the )
  if (userId) {
    const result = userLimiter.consume(`user:${userId}`);
    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSec.toString());
      return res.status(429).json({
        message: 'User request rate limit exceeded. Please wait a moment before retrying.',
        scope: 'user',
        retryAfterSeconds: result.resetSec,
      });
    }
  }

  // 3. Check Public Auth Route Limiting (Brute-force protection for /login)
  if (path.includes('/login') || path.includes('/auth/login')) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = publicAuthLimiter.consume(`ip:${clientIp}`);
    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSec.toString());
      return res.status(429).json({
        message: 'Too many login attempts. Please wait before trying again.',
        scope: 'auth_ip',
        retryAfterSeconds: result.resetSec,
      });
    }
  }

  next();
};