import { Module } from '@nestjs/common';
import { PmAssistantController } from './pm-assistant.controller';
import { PmAssistantService } from './pm-assistant.service';
import { PmAssistantScheduler } from './pm-assistant.scheduler';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../database/prisma.service';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [FeishuModule],
  controllers: [PmAssistantController],
  providers: [PmAssistantService, PmAssistantScheduler, ConfigService, PrismaService]
})
export class PmAssistantModule {}
