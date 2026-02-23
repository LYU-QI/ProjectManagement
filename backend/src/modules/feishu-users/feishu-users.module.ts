import { Module } from '@nestjs/common';
import { FeishuUsersService } from './feishu-users.service';
import { FeishuUsersController } from './feishu-users.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [FeishuUsersService],
  controllers: [FeishuUsersController],
  exports: [FeishuUsersService]
})
export class FeishuUsersModule { }
