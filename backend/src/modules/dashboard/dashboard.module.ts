import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ConfigModule } from '../config/config.module';
import { FeishuModule } from '../feishu/feishu.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [AccessModule, CacheModule, ConfigModule, FeishuModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
