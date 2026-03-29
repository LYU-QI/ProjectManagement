import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AutomationModule } from '../automation/automation.module';
import { DatabaseModule } from '../../database/database.module';
import { TestCaseController } from './test-case/test-case.controller';
import { TestCaseService } from './test-case/test-case.service';
import { TestPlanController } from './test-plan/test-plan.controller';
import { TestPlanService } from './test-plan/test-plan.service';
import { BugController } from './bug/bug.controller';
import { BugService } from './bug/bug.service';

@Module({
  imports: [DatabaseModule, AccessModule, AutomationModule],
  controllers: [TestCaseController, TestPlanController, BugController],
  providers: [TestCaseService, TestPlanService, BugService]
})
export class TesthubModule {}
