import { Controller, Get, Query, Res, Req, Header } from '@nestjs/common';
import { Response } from 'express';
import { CostReportService } from './cost-report.service';

@Controller('api/v1/cost-report')
export class CostReportController {
  constructor(private readonly costReportService: CostReportService) {}

  @Get('summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: Record<string, unknown>
  ) {
    const actor = (req as any)?.user as { sub?: number; role?: string } | undefined;
    const actorOrg = (req as any)?.org as { id: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.costReportService.getSummary(actor, orgId, startDate, endDate);
  }

  @Get('trend')
  async getTrend(@Req() req: Record<string, unknown>) {
    const actor = (req as any)?.user as { sub?: number; role?: string } | undefined;
    const actorOrg = (req as any)?.org as { id: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.costReportService.getTrend(actor, orgId);
  }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="cost-report.xlsx"')
  async exportExcel(@Query('startDate') startDate: string | undefined, @Query('endDate') endDate: string | undefined, @Res() res: Response, @Req() req: Record<string, unknown>) {
    const actor = (req as any)?.user as { sub?: number; role?: string } | undefined;
    const actorOrg = (req as any)?.org as { id: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    const buffer = await this.costReportService.buildExcel(actor, orgId, startDate, endDate);
    res.end(buffer);
  }
}
