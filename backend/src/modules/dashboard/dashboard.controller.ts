import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async overview(@Req() req: { user?: { sub?: number; role?: string } }) {
    return this.dashboardService.overview(req.user);
  }
}
