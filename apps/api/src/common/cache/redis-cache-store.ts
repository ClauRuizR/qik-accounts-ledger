import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { CacheStore } from './cache-store.js';

/** A cache must never slow a request down noticeably. */
const COMMAND_TIMEOUT_MS = 250;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis command timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class RedisCacheStore
  extends CacheStore
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly client: RedisClientType;
  private lastErrorLog = 0;

  constructor(url: string) {
    super();
    this.client = createClient({
      url,
      // Fail fast while disconnected instead of queueing commands until Redis returns.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2_000,
        reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
      },
    });
    // Without a listener, node-redis would crash the process on connection errors.
    this.client.on('error', (error: Error) =>
      this.logThrottled('connection error', error),
    );
  }

  onModuleInit(): void {
    // Not awaited: the API must start (and serve from PostgreSQL) even when Redis is down.
    this.client
      .connect()
      .catch((error: Error) =>
        this.logThrottled('initial connect failed', error),
      );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isReady) await this.client.close();
    else if (this.client.isOpen) this.client.destroy(); // stop reconnect attempts
  }

  async get(key: string): Promise<string | null> {
    if (!this.client.isReady) return null;
    try {
      return await withTimeout(this.client.get(key), COMMAND_TIMEOUT_MS);
    } catch (error) {
      this.logThrottled(`GET ${key} failed`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await withTimeout(
        this.client.set(key, value, { EX: ttlSeconds }),
        COMMAND_TIMEOUT_MS,
      );
    } catch (error) {
      this.logThrottled(`SET ${key} failed`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await withTimeout(this.client.del(key), COMMAND_TIMEOUT_MS);
    } catch (error) {
      this.logThrottled(`DEL ${key} failed`, error);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client.isReady) return false;
    try {
      return (
        (await withTimeout(this.client.ping(), COMMAND_TIMEOUT_MS)) === 'PONG'
      );
    } catch {
      return false;
    }
  }

  /** Test helper: clears the selected Redis database. */
  async flush(): Promise<void> {
    if (this.client.isReady) await this.client.flushDb();
  }

  private logThrottled(message: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorLog < 10_000) return;
    this.lastErrorLog = now;
    this.logger.warn(
      `Redis ${message} — serving from PostgreSQL: ${String(error)}`,
    );
  }
}
