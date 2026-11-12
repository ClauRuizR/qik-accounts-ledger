import { Public } from '../../common/auth/public.decorator.js';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { CacheStore } from '../../common/cache/cache-store.js';

export class HealthStatusDto {
  status!: 'ok' | 'degraded' | 'down';
  database!: 'up' | 'down';
  /** Optional dependency: when down the API keeps working without the cache. */
  redis!: 'up' | 'down';
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: CacheStore,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'All dependencies reachable',
    type: HealthStatusDto,
  })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL is unreachable' })
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthStatusDto> {
    const [database, redis] = await Promise.all([
      this.dataSource
        .query('SELECT 1')
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
      this.cache
        .isHealthy()
        .then((ok) => (ok ? ('up' as const) : ('down' as const))),
    ]);

    // PostgreSQL is required (503 without it); Redis is an optional accelerator.
    res.status(
      database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    const status =
      database === 'down' ? 'down' : redis === 'down' ? 'degraded' : 'ok';
    return { status, database, redis };
  }
}
