import { Controller, Get, Query, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async overview(@Req() req: { user?: { sub?: number; role?: string } }) {
    return this.dashboardService.overview(req.user);
  }

  @Get('efficiency')
  async efficiency(
    @Query('projectId') projectId: string,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      return { error: 'Invalid projectId' };
    }
    return this.dashboardService.efficiency(id, req.user);
  }
}
