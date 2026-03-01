import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';
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

  @IsOptional()
  @IsNumber()
  projectId?: number;
}

class UpdateTimezoneDto {
  @IsString()
  timezone!: string;

  @IsOptional()
  @IsNumber()
  projectId?: number;
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

  @IsOptional()
  @IsNumber()
  projectId?: number;
}

class UpdatePromptConfigsDto {
  @IsNumber()
  projectId!: number;

  @IsObject()
  prompts!: Record<string, string>;
}

@Controller('api/v1/pm-assistant')
export class PmAssistantController {
  constructor(
    private readonly pmAssistantService: PmAssistantService,
    private readonly scheduler: PmAssistantScheduler
  ) {}

  private parseProjectId(value?: string) {
    if (!value) return undefined;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('projectId 必须是正整数');
    }
    return id;
  }

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

  @Get('prompt-configs')
  @Public()
  getPromptConfigs(@Query('projectId') projectIdRaw?: string) {
    const projectId = this.parseProjectId(projectIdRaw);
    return this.pmAssistantService.getPromptConfigs(projectId);
  }

  @Post('prompt-configs')
  @Public()
  updatePromptConfigs(@Body() body: UpdatePromptConfigsDto) {
    if (!body.prompts || typeof body.prompts !== 'object') {
      throw new BadRequestException('prompts 必须是对象');
    }
    return this.pmAssistantService.updatePromptConfigs(body.projectId, body.prompts);
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
  async getLogs(@Query('projectId') projectIdRaw?: string) {
    const projectId = this.parseProjectId(projectIdRaw);
    return this.pmAssistantService.getLogs(100, projectId);
  }

  @Get('schedules')
  @Public()
  getSchedules(@Query('projectId') projectIdRaw?: string) {
    const projectId = this.parseProjectId(projectIdRaw);
    return this.scheduler.getSchedules(projectId);
  }

  @Post('schedules')
  @Public()
  updateSchedule(@Body() body: UpdateScheduleDto) {
    return this.scheduler.updateSchedule(body.id, body.cron, body.projectId);
  }

  @Post('schedules/timezone')
  @Public()
  updateTimezone(@Body() body: UpdateTimezoneDto) {
    return this.scheduler.updateTimezone(body.timezone, body.projectId);
  }

  @Get('configs')
  @Public()
  getConfigs(@Query('projectId') projectIdRaw?: string) {
    const projectId = this.parseProjectId(projectIdRaw);
    return this.pmAssistantService.getJobConfigs(projectId);
  }

  @Post('configs')
  @Public()
  updateConfig(@Body() body: UpdateJobConfigDto) {
    return this.pmAssistantService.updateJobConfig(body.jobId, body.enabled, body.projectId);
  }
}
