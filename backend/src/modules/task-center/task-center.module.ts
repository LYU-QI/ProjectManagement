import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AutomationModule } from '../automation/automation.module';
import { PmAssistantModule } from '../pm-assistant/pm-assistant.module';
import { TaskCenterController } from './task-center.controller';
import { TaskCenterService } from './task-center.service';

@Module({
  imports: [AccessModule, AutomationModule, PmAssistantModule],
  controllers: [TaskCenterController],
  providers: [TaskCenterService]
})
export class TaskCenterModule {}
