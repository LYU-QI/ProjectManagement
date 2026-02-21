import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { SchedulesService } from './schedules.service';
import { Roles } from '../auth/roles.decorator';

class CreateTaskDto {
  @IsNumber()
  projectId!: number;

  @IsNotEmpty()
  title!: string;

  @IsNotEmpty()
  assignee!: string;

  @IsIn(['todo', 'in_progress', 'blocked', 'done'])
  status!: 'todo' | 'in_progress' | 'blocked' | 'done';

  @IsNotEmpty()
  plannedStart!: string;

  @IsNotEmpty()
  plannedEnd!: string;
}

class CreateMilestoneDto {
  @IsNumber()
  projectId!: number;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  plannedDate!: string;
}

class UpdateMilestoneDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  plannedDate?: string;

  @IsOptional()
  actualDate?: string;
}

class UpdateTaskDto {
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsNotEmpty()
  assignee?: string;

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'blocked', 'done'])
  status?: 'todo' | 'in_progress' | 'blocked' | 'done';

  @IsOptional()
  @IsNotEmpty()
  plannedStart?: string;

  @IsOptional()
  @IsNotEmpty()
  plannedEnd?: string;
}

@Controller('api/v1/projects')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get(':id/schedule')
  schedule(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.getProjectSchedule(id);
  }

  @Roles('pm', 'lead')
  @Post('tasks')
  createTask(@Body() body: CreateTaskDto) {
    return this.schedulesService.createTask(body);
  }

  @Roles('pm', 'lead')
  @Patch('tasks/:id')
  updateTask(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.schedulesService.updateTask(id, body);
  }

  @Roles('pm', 'lead')
  @Delete('tasks/:id')
  removeTask(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.removeTask(id);
  }

  @Roles('pm', 'lead')
  @Post('milestones')
  createMilestone(@Body() body: CreateMilestoneDto) {
    return this.schedulesService.createMilestone(body);
  }

  @Roles('pm', 'lead')
  @Patch('milestones/:id')
  updateMilestone(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateMilestoneDto) {
    return this.schedulesService.updateMilestone(id, body);
  }

  @Roles('pm', 'lead')
  @Delete('milestones/:id')
  removeMilestone(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.removeMilestone(id);
  }

  @Get(':id/risks')
  risk(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.risk(id);
  }
}
