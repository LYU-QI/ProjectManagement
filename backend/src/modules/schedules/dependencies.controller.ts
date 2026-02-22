import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { SchedulesService } from './schedules.service';

class CreateDependencyDto {
  @IsNotEmpty()
  projectName!: string;

  @IsNotEmpty()
  taskRecordId!: string;

  @IsOptional()
  taskId?: string;

  @IsNotEmpty()
  dependsOnRecordId!: string;

  @IsOptional()
  dependsOnTaskId?: string;

  @IsIn(['FS', 'SS', 'FF'])
  type!: 'FS' | 'SS' | 'FF';
}

@Controller('api/v1/schedule-dependencies')
export class ScheduleDependenciesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  list(@Query('project') projectName?: string) {
    return this.schedulesService.listDependencies(projectName);
  }

  @Roles('pm', 'lead')
  @Post()
  create(@Body() body: CreateDependencyDto) {
    return this.schedulesService.createDependency(body);
  }

  @Roles('pm', 'lead')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.removeDependency(id);
  }
}
