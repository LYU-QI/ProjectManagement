import { Global, Module } from '@nestjs/common';
import { FeishuModule } from '../feishu/feishu.module';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Global()
@Module({
  imports: [FeishuModule],
  controllers: [RisksController],
  providers: [RisksService],
  exports: [RisksService]
})
export class RisksModule {}
