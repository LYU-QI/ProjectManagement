import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HealthService } from './health.service';
import { AlertService } from './alert.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { MonitoringController } from './monitoring.controller';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [MonitoringController],
  providers: [MetricsService, HealthService, AlertService, MetricsInterceptor],
  exports: [MetricsService, HealthService, AlertService],
})
export class MonitoringModule {}
