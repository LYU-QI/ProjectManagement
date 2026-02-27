import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
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
  schedule(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.getProjectSchedule(req.user, id);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post('tasks')
  createTask(@Body() body: CreateTaskDto, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.createTask(req.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch('tasks/:id')
  updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.schedulesService.updateTask(req.user, id, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete('tasks/:id')
  removeTask(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.removeTask(req.user, id);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post('milestones')
  createMilestone(@Body() body: CreateMilestoneDto, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.createMilestone(req.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch('milestones/:id')
  updateMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMilestoneDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.schedulesService.updateMilestone(req.user, id, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete('milestones/:id')
  removeMilestone(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.removeMilestone(req.user, id);
  }

  @Get(':id/risks')
  risk(@Param('id', ParseIntPipe) id: number, @Req() req: { user?: { sub?: number; role?: string } }) {
    return this.schedulesService.risk(req.user, id);
  }
}
