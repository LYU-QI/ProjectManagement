import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { WorklogsService } from './worklogs.service';

class CreateWorklogDto {
  @IsNumber()
  projectId!: number;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  taskTitle?: string;

  @IsNumber()
  hours!: number;

  @IsNumber()
  hourlyRate!: number;

  @IsNotEmpty()
  workedOn!: string;
}

class UpdateWorklogDto {
  @IsOptional()
  @IsNotEmpty()
  taskTitle?: string;

  @IsOptional()
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsNotEmpty()
  workedOn?: string;
}

@Controller('api/v1/worklogs')
export class WorklogsController {
  constructor(private readonly worklogsService: WorklogsService) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.worklogsService.list(projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead')
  @Post()
  create(@Body() body: CreateWorklogDto) {
    return this.worklogsService.create(body);
  }

  @Roles('pm', 'lead')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateWorklogDto) {
    return this.worklogsService.update(id, body);
  }

  @Roles('pm', 'lead')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.worklogsService.remove(id);
  }
}
