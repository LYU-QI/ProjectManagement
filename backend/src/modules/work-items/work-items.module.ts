import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AutomationModule } from '../automation/automation.module';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [AccessModule, AutomationModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService]
})
export class WorkItemsModule {}
