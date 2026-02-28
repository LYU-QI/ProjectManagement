import { Module } from '@nestjs/common';
import { FeishuController } from './feishu.controller';
import { FeishuService } from './feishu.service';
import { ConfigModule } from '../config/config.module';
import { FeishuUsersModule } from '../feishu-users/feishu-users.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [ConfigModule, FeishuUsersModule, AccessModule],
  controllers: [FeishuController],
  providers: [FeishuService],
  exports: [FeishuService]
})
export class FeishuModule { }
