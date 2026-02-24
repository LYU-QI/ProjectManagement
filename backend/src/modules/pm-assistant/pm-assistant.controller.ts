import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, IsNumber } from 'class-validator';
import { PmAssistantService } from './pm-assistant.service';
import { PmAssistantScheduler } from './pm-assistant.scheduler';
import type { PmJobId } from './pm-assistant.types';
import { Public } from '../auth/public.decorator';

class RunJobDto {
  @IsString()
  @IsIn([
    'morning-briefing',
    'meeting-materials',
    'risk-alerts',
    'overdue-reminder',
    'milestone-reminder',
    'blocked-alert',
    'resource-load',
    'progress-board',
    'trend-predict',
    'weekly-agenda',
    'daily-report',
    'weekly-report'
  ])
  jobId!: PmJobId;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  receiveId?: string;

  @IsOptional()
  @IsString()
  receiveIds?: string;

  @IsOptional()
  @IsNumber()
  projectId?: number;
}

class UpdateScheduleDto {
  @IsString()
  id!: string;

  @IsString()
  cron!: string;
}

class UpdateTimezoneDto {
  @IsString()
  timezone!: string;
}

class UpdateJobConfigDto {
  @IsString()
  @IsIn([
    'morning-briefing',
    'meeting-materials',
    'risk-alerts',
    'overdue-reminder',
    'milestone-reminder',
    'blocked-alert',
    'resource-load',
    'progress-board',
    'trend-predict',
    'weekly-agenda',
    'daily-report',
    'weekly-report'
  ])
  jobId!: PmJobId;

  @IsBoolean()
  enabled!: boolean;
}

@Controller('api/v1/pm-assistant')
export class PmAssistantController {
  constructor(
    private readonly pmAssistantService: PmAssistantService,
    private readonly scheduler: PmAssistantScheduler
  ) {}

  @Get('jobs')
  @Public()
  listJobs() {
    return this.pmAssistantService.listJobs();
  }

  @Get('prompts')
  @Public()
  listDefaultPrompts() {
    return this.pmAssistantService.getDefaultSystemPrompts();
  }

  @Post('run')
  @Public()
  runJob(@Body() body: RunJobDto) {
    return this.pmAssistantService.runJob(body.jobId, {
      dryRun: body.dryRun,
      receiveId: body.receiveId,
      receiveIds: body.receiveIds ? body.receiveIds.split(/[,;\n]/).map((id) => id.trim()).filter(Boolean) : undefined,
      projectId: body.projectId,
      triggeredBy: 'manual'
    });
  }

  @Get('logs')
  @Public()
  async getLogs() {
    return this.pmAssistantService.getLogs();
  }

  @Get('schedules')
  @Public()
  getSchedules() {
    return this.scheduler.getSchedules();
  }

  @Post('schedules')
  @Public()
  updateSchedule(@Body() body: UpdateScheduleDto) {
    return this.scheduler.updateSchedule(body.id, body.cron);
  }

  @Post('schedules/timezone')
  @Public()
  updateTimezone(@Body() body: UpdateTimezoneDto) {
    return this.scheduler.updateTimezone(body.timezone);
  }

  @Get('configs')
  @Public()
  getConfigs() {
    return this.pmAssistantService.getJobConfigs();
  }

  @Post('configs')
  @Public()
  updateConfig(@Body() body: UpdateJobConfigDto) {
    return this.pmAssistantService.updateJobConfig(body.jobId, body.enabled);
  }
}
