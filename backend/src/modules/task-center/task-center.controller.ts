import { Controller, Get, Query, Req } from '@nestjs/common';
import { TaskCenterService, TaskCenterSource, TaskCenterStatus } from './task-center.service';

@Controller('api/v1/task-center')
export class TaskCenterController {
  constructor(private readonly taskCenterService: TaskCenterService) {}

  @Get('items')
  list(
    @Req() req: Record<string, unknown>,
    @Query('projectId') projectIdRaw?: string,
    @Query('source') source?: TaskCenterSource,
    @Query('status') status?: TaskCenterStatus,
    @Query('limit') limitRaw?: string
  ) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const org = req.org as { id?: string | null } | undefined;
    const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.taskCenterService.list(actor, org?.id ?? '', {
      projectId,
      source,
      status,
      limit
    });
  }

  @Get('stats')
  stats(
    @Req() req: Record<string, unknown>,
    @Query('projectId') projectIdRaw?: string,
    @Query('source') source?: TaskCenterSource,
    @Query('days') daysRaw?: string
  ) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const org = req.org as { id?: string | null } | undefined;
    const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;
    const days = daysRaw ? Number(daysRaw) : undefined;
    return this.taskCenterService.getStats(actor, org?.id ?? '', {
      projectId,
      source,
      days
    });
  }
}
