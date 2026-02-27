import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
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
  assigneeName?: string;

  @IsOptional()
  taskTitle?: string;

  @IsOptional()
  weekStart?: string;

  @IsOptional()
  weekEnd?: string;

  @IsOptional()
  @IsNumber()
  totalDays?: number;

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
  assigneeName?: string;

  @IsOptional()
  weekStart?: string;

  @IsOptional()
  weekEnd?: string;

  @IsOptional()
  @IsNumber()
  totalDays?: number;

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
  list(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.worklogsService.list(req?.user, projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post()
  create(@Body() body: CreateWorklogDto, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.worklogsService.create(req?.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateWorklogDto,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.worklogsService.update(req?.user, id, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.worklogsService.remove(req?.user, id);
  }
}
