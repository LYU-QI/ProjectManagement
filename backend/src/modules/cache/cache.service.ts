import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly defaultTtl = 300; // 5 minutes

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      retryStrategy: (times: number) => {
        if (times > 10) {
          this.logger.error('Redis connection failed after 10 retries, giving up');
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.connect().catch((err: Error) => {
      this.logger.error(`Redis initial connection failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private isConnected(): boolean {
    return this.client.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) {
      return null;
    }
    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Redis GET failed for key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTtl;
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.error(`Redis SET failed for key ${key}: ${(error as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL failed for key ${key}: ${(error as Error).message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Redis DEL pattern failed for ${pattern}: ${(error as Error).message}`);
    }
  }
}
