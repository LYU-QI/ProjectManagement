import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { TaskCenterController } from './task-center.controller';
import { TaskCenterService } from './task-center.service';

@Module({
  imports: [AccessModule],
  controllers: [TaskCenterController],
  providers: [TaskCenterService]
})
export class TaskCenterModule {}
