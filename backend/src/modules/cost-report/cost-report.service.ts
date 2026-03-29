import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import * as XLSX from 'xlsx';

interface CostSummary {
  totalLabor: number;
  totalOutsource: number;
  totalCloud: number;
  total: number;
  byProject: Array<{
    projectId: number;
    projectName: string;
    labor: number;
    outsource: number;
    cloud: number;
    total: number;
  }>;
  byMonth: Array<{
    month: string;
    labor: number;
    outsource: number;
    cloud: number;
    total: number;
  }>;
  byType: Array<{
    type: string;
    total: number;
  }>;
}

interface CostTrend {
  month: string;
  labor: number;
  outsource: number;
  cloud: number;
  total: number;
}

@Injectable()
export class CostReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async getSummary(
    actor: AuthActor | undefined,
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CostSummary> {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }

    const entries = await this.prisma.costEntry.findMany({
      where: {
        project: { organizationId },
        ...(Object.keys(dateFilter).length > 0 ? { occurredOn: dateFilter } : {})
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { occurredOn: 'asc' }
    });

    let totalLabor = 0;
    let totalOutsource = 0;
    let totalCloud = 0;

    const projectMap = new Map<number, { projectId: number; projectName: string; labor: number; outsource: number; cloud: number; total: number }>();
    const monthMap = new Map<string, { month: string; labor: number; outsource: number; cloud: number; total: number }>();
    const typeMap = new Map<string, number>();

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.type === 'labor') totalLabor += amount;
      else if (entry.type === 'outsource') totalOutsource += amount;
      else if (entry.type === 'cloud') totalCloud += amount;

      // By project
      if (!projectMap.has(entry.projectId)) {
        projectMap.set(entry.projectId, { projectId: entry.projectId, projectName: entry.project.name, labor: 0, outsource: 0, cloud: 0, total: 0 });
      }
      const proj = projectMap.get(entry.projectId)!;
      if (entry.type === 'labor') proj.labor += amount;
      else if (entry.type === 'outsource') proj.outsource += amount;
      else if (entry.type === 'cloud') proj.cloud += amount;
      proj.total += amount;

      // By month
      const month = entry.occurredOn.slice(0, 7);
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, labor: 0, outsource: 0, cloud: 0, total: 0 });
      }
      const monthEntry = monthMap.get(month)!;
      if (entry.type === 'labor') monthEntry.labor += amount;
      else if (entry.type === 'outsource') monthEntry.outsource += amount;
      else if (entry.type === 'cloud') monthEntry.cloud += amount;
      monthEntry.total += amount;

      // By type
      typeMap.set(entry.type, (typeMap.get(entry.type) ?? 0) + amount);
    }

    return {
      totalLabor,
      totalOutsource,
      totalCloud,
      total: totalLabor + totalOutsource + totalCloud,
      byProject: Array.from(projectMap.values()).sort((a, b) => b.total - a.total),
      byMonth: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      byType: Array.from(typeMap.entries()).map(([type, total]) => ({ type, total }))
    };
  }

  async getTrend(actor: AuthActor | undefined, organizationId: string): Promise<CostTrend[]> {
    const entries = await this.prisma.costEntry.findMany({
      where: { project: { organizationId } },
      orderBy: { occurredOn: 'asc' }
    });

    const monthMap = new Map<string, CostTrend>();

    for (const entry of entries) {
      const month = entry.occurredOn.slice(0, 7);
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, labor: 0, outsource: 0, cloud: 0, total: 0 });
      }
      const m = monthMap.get(month)!;
      const amount = Number(entry.amount);
      if (entry.type === 'labor') m.labor += amount;
      else if (entry.type === 'outsource') m.outsource += amount;
      else if (entry.type === 'cloud') m.cloud += amount;
      m.total += amount;
    }

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  async buildExcel(actor: AuthActor | undefined, organizationId: string, startDate?: string, endDate?: string): Promise<Buffer> {
    const summary = await this.getSummary(actor, organizationId, startDate, endDate);

    // Summary sheet
    const summaryData = [
      ['成本汇总报表'],
      [''],
      ['类型', '金额 (CNY)'],
      ['劳动力成本', summary.totalLabor],
      ['外包成本', summary.totalOutsource],
      ['云服务成本', summary.totalCloud],
      ['总计', summary.total],
      [''],
      ['按项目明细'],
      ['项目', '劳动力', '外包', '云服务', '合计'],
      ...summary.byProject.map(p => [p.projectName, p.labor, p.outsource, p.cloud, p.total]),
      [''],
      ['按月度趋势'],
      ['月份', '劳动力', '外包', '云服务', '合计'],
      ...summary.byMonth.map(m => [m.month, m.labor, m.outsource, m.cloud, m.total])
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);

    // Auto-width columns
    const colWidths = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成本汇总');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer) as unknown as Buffer;
  }
}
