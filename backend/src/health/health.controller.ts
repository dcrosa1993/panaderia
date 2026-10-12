import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('liveness')
  getLiveness(): { status: 'ok' } {
    return this.healthService.getLiveness();
  }

  @Get('readiness')
  getReadiness(): Promise<{ status: 'ok' }> {
    return this.healthService.getReadiness();
  }
}
