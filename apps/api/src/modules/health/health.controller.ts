import { Public } from '../../common/auth/public.decorator.js';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';

export class HealthStatusDto {
  status!: 'ok' | 'degraded';
  database!: 'up' | 'down';
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOkResponse({
    description: 'All dependencies reachable',
    type: HealthStatusDto,
  })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthStatusDto> {
    const database = await this.dataSource
      .query('SELECT 1')
      .then(() => 'up' as const)
      .catch(() => 'down' as const);

    const healthy = database === 'up';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'degraded', database };
  }
}
