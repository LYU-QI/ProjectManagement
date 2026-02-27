import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SchedulesController } from './schedules.controller';
import { ScheduleDependenciesController } from './dependencies.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [AccessModule],
  controllers: [SchedulesController, ScheduleDependenciesController],
  providers: [SchedulesService]
})
export class SchedulesModule {}
