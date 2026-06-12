import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async overview(@Req() req: { user?: { sub?: number; role?: string } }) {
    return this.dashboardService.overview(req.user);
  }

  @Get('cluster-risk-board')
  async clusterRiskBoard(
    @Query('force') force: string,
    @Req() req: { user?: { sub?: number; name?: string; role?: string; organizationId?: string }; org?: { id?: string | null } }
  ) {
    return this.dashboardService.clusterRiskBoard({ ...req.user, organizationId: req.org?.id ?? req.user?.organizationId }, force === 'true');
  }

  @Post('cluster-risk-board')
  @Roles('super_admin', 'project_manager')
  async createClusterRiskBoard(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number; name?: string; role?: string; organizationId?: string }; org?: { id?: string | null } }
  ) {
    return this.dashboardService.createClusterRiskBoardItem(
      body || {},
      { ...req.user, organizationId: req.org?.id ?? req.user?.organizationId }
    );
  }

  @Put('cluster-risk-board/:recordId')
  @Roles('super_admin', 'project_manager', 'pm')
  async updateClusterRiskBoard(
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number; name?: string; role?: string; organizationId?: string }; org?: { id?: string | null } }
  ) {
    return this.dashboardService.updateClusterRiskBoardItem(
      recordId,
      body || {},
      { ...req.user, organizationId: req.org?.id ?? req.user?.organizationId }
    );
  }

  @Get('delivery-roadmap')
  async deliveryRoadmap(
    @Query('force') force: string,
    @Req() req: { user?: { sub?: number; role?: string; organizationId?: string } }
  ) {
    return this.dashboardService.deliveryRoadmap(req.user, force === 'true');
  }

  @Get('resource-calendar')
  async resourceCalendar(
    @Query('force') force: string,
    @Req() req: { user?: { sub?: number; role?: string; organizationId?: string } }
  ) {
    return this.dashboardService.resourceCalendar(req.user, force === 'true');
  }

  @Get('project-weekly-report')
  async projectWeeklyReport(
    @Query('projectId') projectId: string,
    @Query('weekStart') weekStart: string | undefined,
    @Query('weekEnd') weekEnd: string | undefined,
    @Req() req: { user?: { sub?: number; name?: string; role?: string; organizationId?: string }; org?: { id?: string | null } }
  ) {
    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      return { error: 'Invalid projectId' };
    }
    return this.dashboardService.projectWeeklyReport(
      id,
      { weekStart, weekEnd },
      { ...req.user, organizationId: req.org?.id ?? req.user?.organizationId }
    );
  }

  @Get('feature-list-board')
  async featureListBoard(
    @Query('projectId') projectId: string,
    @Req() req: { user?: { sub?: number; name?: string; role?: string; organizationId?: string }; org?: { id?: string | null } }
  ) {
    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      return { error: 'Invalid projectId' };
    }
    return this.dashboardService.featureListBoard(
      id,
      { ...req.user, organizationId: req.org?.id ?? req.user?.organizationId }
    );
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
