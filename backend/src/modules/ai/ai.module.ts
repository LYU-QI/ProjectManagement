import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConfigModule } from '../config/config.module';
import { FeishuModule } from '../feishu/feishu.module';
import { AccessModule } from '../access/access.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [ConfigModule, FeishuModule, AccessModule, CapabilitiesModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule { }
