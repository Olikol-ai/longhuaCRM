import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Legacy alias — same as /health/ready */
  @Get()
  async check() {
    return this.ready();
  }

  /** Liveness probe — process is running (no DB check) */
  @Get('live')
  live() {
    return this.health.live();
  }

  /** Readiness probe — includes database connectivity */
  @Get('ready')
  async ready() {
    const status = await this.health.ready();
    if (!status.ok) {
      throw new ServiceUnavailableException(status);
    }
    return status;
  }
}
