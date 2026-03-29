import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationEngineService } from './automation-engine.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessModule } from '../access/access.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [NotificationsModule, AccessModule],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationEngineService, PrismaService],
  exports: [AutomationService, AutomationEngineService]
})
export class AutomationModule {}
