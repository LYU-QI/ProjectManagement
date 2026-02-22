import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { ScheduleDependenciesController } from './dependencies.controller';
import { SchedulesService } from './schedules.service';

@Module({
  controllers: [SchedulesController, ScheduleDependenciesController],
  providers: [SchedulesService]
})
export class SchedulesModule {}
