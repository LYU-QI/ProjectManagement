import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FeishuModule } from '../feishu/feishu.module';
import { ConfigModule } from '../config/config.module';
import { AccessModule } from '../access/access.module';

@Global()
@Module({
  imports: [FeishuModule, ConfigModule, AccessModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
