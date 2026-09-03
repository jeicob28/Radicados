import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Public } from '../auth/decorators';

@ApiTags('sistema')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la API y de sus dependencias (postgres, redis, minio)' })
  async health() {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'error';
    }

    const redis = new Redis(this.config.get<string>('redisUrl')!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    } finally {
      redis.disconnect();
    }

    checks.minio = (await this.storage.ping()) ? 'ok' : 'error';

    const status = Object.values(checks).every((v) => v === 'ok') ? 'ok' : 'degraded';
    return {
      status,
      servicio: 'backend-api',
      version: '0.1.0',
      checks,
      ts: new Date().toISOString(),
    };
  }
}
