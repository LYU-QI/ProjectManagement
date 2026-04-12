import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ProjectMetricsModule } from '../project-metrics/project-metrics.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';

@Module({
  imports: [AccessModule, ProjectMetricsModule],
  controllers: [CostsController],
  providers: [CostsService]
})
export class CostsModule {}
