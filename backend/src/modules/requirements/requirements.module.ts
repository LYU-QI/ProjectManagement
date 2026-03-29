import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AutomationModule } from '../automation/automation.module';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';

@Module({
  imports: [AccessModule, AutomationModule],
  controllers: [RequirementsController],
  providers: [RequirementsService]
})
export class RequirementsModule {}
