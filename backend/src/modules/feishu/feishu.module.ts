import { Module } from '@nestjs/common';
import { FeishuController } from './feishu.controller';
import { FeishuService } from './feishu.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [FeishuController],
  providers: [FeishuService],
  exports: [FeishuService]
})
export class FeishuModule { }
