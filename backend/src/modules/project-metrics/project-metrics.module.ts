import { Module } from '@nestjs/common';
import { ProjectMetricsService } from './project-metrics.service';

@Module({
  providers: [ProjectMetricsService],
  exports: [ProjectMetricsService]
})
export class ProjectMetricsModule {}
