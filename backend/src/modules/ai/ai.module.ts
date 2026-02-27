import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConfigModule } from '../config/config.module';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [ConfigModule, FeishuModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule { }
