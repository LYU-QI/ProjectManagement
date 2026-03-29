import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../cache/cache.service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: {
    postgres: { status: 'up' | 'down'; latencyMs?: number; error?: string };
    redis: { status: 'up' | 'down' | 'not_configured'; latencyMs?: number; error?: string };
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const [postgresResult, redisStatus] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const allUp = postgresResult.status === 'up' && redisStatus.status === 'up';
    const allDegraded =
      postgresResult.status === 'down' && redisStatus.status !== 'up';

    return {
      status: allUp ? 'healthy' : allDegraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      services: {
        postgres: postgresResult,
        redis: redisStatus,
      },
    };
  }

  private async checkPostgres(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async checkRedis(): Promise<{ status: 'up' | 'down' | 'not_configured'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const testKey = '__health_check__';
      await this.redis.set(testKey, { ok: true }, 5);
      const value = await this.redis.get<{ ok: boolean }>(testKey);
      if (value === null) {
        return { status: 'down', error: 'Redis set/get failed' };
      }
      await this.redis.del(testKey);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
