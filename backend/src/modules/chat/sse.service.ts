import { Response } from 'express';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Service } from 'typedi';
import { REDIS_URL, isRedisEnabled } from '@config';

export interface SSEMessagePayload {
  event: string;
  data: any;
  targetDeviceId?: string;
}

@Service()
export class SSEService {
  private localEmitter = new EventEmitter();
  private clients: Set<{ res: Response; conversationId: string; deviceId: string }> = new Set();
  private redisSub: Redis | null = null;
  private redisPub: Redis | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly REDIS_CHANNEL = 'chatSSE:events';

  constructor() {
    this.localEmitter.setMaxListeners(200);
    this.initPubSub();
    this.startHeartbeat();
  }

  private initPubSub() {
    if (isRedisEnabled()) {
      try {
        const subClient = new Redis(REDIS_URL, {
          lazyConnect: true,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 300, 2000)),
        });

        const pubClient = new Redis(REDIS_URL, {
          lazyConnect: true,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 300, 2000)),
        });

        subClient.on('error', (err) => {
          console.warn('[SSE Redis Sub] Error:', err.message);
        });

        pubClient.on('error', (err) => {
          console.warn('[SSE Redis Pub] Error:', err.message);
        });

        Promise.all([subClient.connect(), pubClient.connect()])
          .then(() => {
            this.redisSub = subClient;
            this.redisPub = pubClient;

            this.redisSub.subscribe(this.REDIS_CHANNEL, (err) => {
              if (err) {
                console.warn('[SSE Redis] Failed to subscribe to channel:', err.message);
              } else {
                console.log(`[SSE Redis] Subscribed to ${this.REDIS_CHANNEL} ✅`);
              }
            });

            this.redisSub.on('message', (channel, messageStr) => {
              if (channel === this.REDIS_CHANNEL) {
                try {
                  const payload: SSEMessagePayload = JSON.parse(messageStr);
                  this.dispatchToLocalClients(payload.event, payload.data, payload.targetDeviceId);
                } catch (e) {
                  console.error('[SSE Redis] Parse error:', e);
                }
              }
            });
          })
          .catch((err) => {
            console.warn('[SSE Redis] Connection failed, using in-memory fallback:', err.message);
          });
      } catch (err: any) {
        console.warn('[SSE Redis] Initialization failed, using in-memory fallback:', err?.message);
      }
    }

    // Always listen to local EventEmitter for fallback
    this.localEmitter.on('broadcast', (payload: SSEMessagePayload) => {
      this.dispatchToLocalClients(payload.event, payload.data, payload.targetDeviceId);
    });
  }

  public registerClient(res: Response, conversationId: string = 'live', deviceId: string = ''): () => void {
    // Standard SSE headers (disable buffering, compression, and caching)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const client = { res, conversationId, deviceId };
    this.clients.add(client);

    // Initial greeting
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', deviceId, timestamp: Date.now() })}\n\n`);

    const cleanup = () => {
      this.clients.delete(client);
      try {
        res.end();
      } catch (e) {
        // ignore
      }
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    return cleanup;
  }

  public async broadcast(event: string, data: any, targetDeviceId?: string): Promise<void> {
    const payload: SSEMessagePayload = { event, data, targetDeviceId };
    const payloadStr = JSON.stringify(payload);

    if (this.redisPub && this.redisPub.status === 'ready') {
      try {
        await this.redisPub.publish(this.REDIS_CHANNEL, payloadStr);
        return;
      } catch (err: any) {
        console.warn('[SSE Redis Pub] Failed, falling back to local emit:', err.message);
      }
    }

    // In-memory broadcast fallback
    this.localEmitter.emit('broadcast', payload);
  }

  private dispatchToLocalClients(event: string, data: any, targetDeviceId?: string) {
    const dataStr = JSON.stringify(data);
    const sseFormatted = `event: ${event}\ndata: ${dataStr}\n\n`;

    for (const client of this.clients) {
      // If targetDeviceId is present, deliver only to matching client device
      if (targetDeviceId && client.deviceId && client.deviceId !== targetDeviceId) {
        continue;
      }
      try {
        client.res.write(sseFormatted);
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(`event: ping\ndata: {}\n\n`);
        } catch (e) {
          this.clients.delete(client);
        }
      }
    }, 25000);
  }

  public close() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.redisSub) this.redisSub.disconnect();
    if (this.redisPub) this.redisPub.disconnect();
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch (e) {
        // ignore
      }
    }
    this.clients.clear();
  }
}
