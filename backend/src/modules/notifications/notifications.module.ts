import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { AlertService } from './alert.service';
import { FeishuModule } from '../feishu/feishu.module';
import { ConfigModule } from '../config/config.module';
import { AccessModule } from '../access/access.module';

@Global()
@Module({
  imports: [FeishuModule, ConfigModule, AccessModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, AlertService],
  exports: [NotificationsService, EmailService, AlertService]
})
export class NotificationsModule {}
