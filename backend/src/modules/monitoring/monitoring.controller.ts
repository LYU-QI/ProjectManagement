import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { MetricsService } from './metrics.service';
import { HealthService } from './health.service';

@Controller()
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get('health')
  async getHealth() {
    return this.healthService.getHealth();
  }

  @Public()
  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    const metrics = this.metricsService.toPrometheusFormat();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  }
}
