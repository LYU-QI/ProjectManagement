import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { FeishuModule } from '../feishu/feishu.module';
import { ResourceMaintenanceController } from './resource-maintenance.controller';
import { ResourceMaintenanceService } from './resource-maintenance.service';

@Module({
  imports: [ConfigModule, FeishuModule],
  controllers: [ResourceMaintenanceController],
  providers: [ResourceMaintenanceService]
})
export class ResourceMaintenanceModule {}
