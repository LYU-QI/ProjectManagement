import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
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
  list(@Query('project') projectName?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.listDependencies(req?.user, projectName);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post()
  create(@Body() body: CreateDependencyDto, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.createDependency(req?.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.removeDependency(req?.user, id);
  }
}
