import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConfigModule } from '../config/config.module';
import { FeishuModule } from '../feishu/feishu.module';
import { AccessModule } from '../access/access.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { ProjectMetricsModule } from '../project-metrics/project-metrics.module';

@Module({
  imports: [ConfigModule, FeishuModule, AccessModule, CapabilitiesModule, ProjectMetricsModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule { }
