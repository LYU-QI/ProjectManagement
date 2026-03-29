import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [AccessModule, CacheModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
