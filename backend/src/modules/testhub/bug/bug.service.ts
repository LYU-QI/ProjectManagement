import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService, AuthActor } from '../../../modules/access/access.service';
import { CreateBugDto, UpdateBugDto, ListBugQueryDto } from './dto/bug.dto';

type BugImportStatus = 'success' | 'failed' | 'skipped';

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  rejected: '已驳回'
};

const SEVERITY_LABELS: Record<string, string> = {
  blocker: '阻断',
  critical: '严重',
  major: '主要',
  minor: '次要',
  trivial: '轻微'
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低'
};

const STATUS_BY_LABEL: Record<string, string> = {
  待处理: 'open',
  打开: 'open',
  open: 'open',
  处理中: 'in_progress',
  处理: 'in_progress',
  in_progress: 'in_progress',
  已解决: 'resolved',
  resolved: 'resolved',
  已关闭: 'closed',
  closed: 'closed',
  已驳回: 'rejected',
  驳回: 'rejected',
  rejected: 'rejected'
};

const SEVERITY_BY_LABEL: Record<string, string> = {
  阻断: 'blocker',
  blocker: 'blocker',
  严重: 'critical',
  critical: 'critical',
  主要: 'major',
  major: 'major',
  次要: 'minor',
  minor: 'minor',
  轻微: 'trivial',
  trivial: 'trivial'
};

const PRIORITY_BY_LABEL: Record<string, string> = {
  紧急: 'urgent',
  urgent: 'urgent',
  高: 'high',
  high: 'high',
  中: 'medium',
  medium: 'medium',
  低: 'low',
  low: 'low'
};

@Injectable()
export class BugService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, query: ListBugQueryDto) {
    const where = await this.buildBugWhere(actor, query);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.bug.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } },
          testCase: { select: { id: true, title: true } }
        }
      }),
      this.prisma.bug.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  private normalizeCell(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeHeader(value: unknown): string {
    return this.normalizeCell(value).replace(/\s+/g, '').toLowerCase();
  }

  private getImportCell(row: Record<string, unknown>, aliases: string[]): string {
    const normalizedAliases = new Set(aliases.map((alias) => this.normalizeHeader(alias)));
    for (const [key, value] of Object.entries(row)) {
      if (normalizedAliases.has(this.normalizeHeader(key))) {
        return this.normalizeCell(value);
      }
    }
    return '';
  }

  private parseBugRows(file: Express.Multer.File): Array<Record<string, unknown>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 Excel 或 CSV 文件');
    }
    const lowerName = (file.originalname || '').toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      throw new BadRequestException('仅支持 .xlsx、.xls、.csv 文件');
    }
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('导入文件没有可读取的工作表');
    }
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  private resolveEnum(input: string, maps: Record<string, string>, fallback: string): string {
    const value = this.normalizeCell(input);
    if (!value) return fallback;
    return maps[value] ?? maps[value.toLowerCase()] ?? fallback;
  }

  private async buildBugWhere(actor: AuthActor | undefined, query: ListBugQueryDto) {
    const projectId = query.projectId;
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { steps: { contains: query.search } },
        { clientContext: { contains: query.search } },
        { memoryContext: { contains: query.search } },
        { expectedResult: { contains: query.search } },
        { actualResult: { contains: query.search } },
        { targetPerson: { contains: query.search } },
        { requestId: { contains: query.search } },
        { fixStatus: { contains: query.search } }
      ];
    }
    return where;
  }

  async findById(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.bug.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        testCase: { select: { id: true, title: true } }
      }
    });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return item;
  }

  async exportExcel(actor: AuthActor | undefined, query: ListBugQueryDto): Promise<Buffer> {
    const where = await this.buildBugWhere(actor, query);
    const items = await this.prisma.bug.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        testCase: { select: { id: true, title: true } }
      }
    });

    const rows = items.map((bug) => ({
      ID: bug.id,
      项目: bug.project?.name ?? '',
      问题描述: bug.title,
      端侧上下文: bug.clientContext ?? '',
      记忆上下文: bug.memoryContext ?? '',
      预期结果: bug.expectedResult ?? '',
      实际结果: bug.actualResult ?? '',
      指向人: bug.targetPerson ?? '',
      request_id: bug.requestId ?? '',
      修复状态: bug.fixStatus ?? '',
      状态: STATUS_LABELS[bug.status] ?? bug.status,
      严重性: SEVERITY_LABELS[bug.severity] ?? bug.severity,
      优先级: PRIORITY_LABELS[bug.priority] ?? bug.priority,
      负责人: bug.assigneeName ?? '',
      创建人: bug.reporterName ?? '',
      问题创建时间: bug.issueCreatedAt ?? bug.createdAt.toISOString().slice(0, 10),
      最新修改日期: bug.lastModifiedAt ?? bug.updatedAt.toISOString().slice(0, 10),
      备注复现步骤: bug.steps ?? '',
      关联用例: bug.testCase?.title ?? ''
    }));

    const templateRows = rows.length > 0
      ? rows
      : [{
        ID: '',
        项目: '',
        问题描述: '',
        端侧上下文: '',
        记忆上下文: '',
        预期结果: '',
        实际结果: '',
        指向人: '',
        request_id: '',
        修复状态: '',
        状态: '待处理',
        严重性: '主要',
        优先级: '中',
        负责人: '',
        创建人: '',
        问题创建时间: new Date().toISOString().slice(0, 10),
        最新修改日期: new Date().toISOString().slice(0, 10),
        备注复现步骤: '',
        关联用例: ''
      }];
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet['!cols'] = [
      { wch: 8 }, { wch: 18 }, { wch: 36 }, { wch: 28 }, { wch: 28 },
      { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 20 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '缺陷列表');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer) as unknown as Buffer;
  }

  async importExcel(actor: AuthActor | undefined, projectId: number, file: Express.Multer.File) {
    await this.accessService.assertProjectAccess(actor, projectId);
    const rows = this.parseBugRows(file);
    if (rows.length === 0) {
      throw new BadRequestException('导入文件没有数据行');
    }
    if (rows.length > 1000) {
      throw new BadRequestException('单次最多导入 1000 行');
    }

    const actorId = Number(actor?.sub);
    const [project, actorUser] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true }
      }),
      actorId
        ? this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })
        : Promise.resolve(null)
    ]);
    const existingIds = rows
      .map((row) => Number(this.getImportCell(row, ['ID', 'id', '缺陷ID'])))
      .filter((id) => Number.isInteger(id) && id > 0);
    const existingBugs = existingIds.length
      ? await this.prisma.bug.findMany({
        where: { id: { in: existingIds }, projectId },
        select: { id: true }
      })
      : [];
    const existingBugIds = new Set(existingBugs.map((bug) => bug.id));
    const seenIds = new Set<number>();

    const results: Array<{
      row: number;
      id?: number;
      title?: string;
      status: BugImportStatus;
      message: string;
    }> = [];
    let created = 0;
    let updated = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const idText = this.getImportCell(row, ['ID', 'id', '缺陷ID']);
      const id = Number(idText);
      const title = this.getImportCell(row, ['问题描述', '标题', 'title']);
      const hasAnyValue = Object.values(row).some((value) => this.normalizeCell(value));
      if (!hasAnyValue) {
        results.push({ row: rowNumber, status: 'skipped', message: '空行已跳过' });
        continue;
      }
      if (!title) {
        results.push({ row: rowNumber, id: Number.isInteger(id) ? id : undefined, status: 'failed', message: '问题描述不能为空' });
        continue;
      }
      if (Number.isInteger(id) && id > 0) {
        if (seenIds.has(id)) {
          results.push({ row: rowNumber, id, title, status: 'failed', message: '导入文件中存在重复 ID' });
          continue;
        }
        seenIds.add(id);
        if (!existingBugIds.has(id)) {
          results.push({ row: rowNumber, id, title, status: 'failed', message: 'ID 不属于当前项目或缺陷不存在' });
          continue;
        }
      }

      const data = {
        title,
        clientContext: this.getImportCell(row, ['端侧上下文', 'clientContext']) || null,
        memoryContext: this.getImportCell(row, ['记忆上下文', 'memoryContext']) || null,
        expectedResult: this.getImportCell(row, ['预期结果', 'expectedResult']) || null,
        actualResult: this.getImportCell(row, ['实际结果', 'actualResult']) || null,
        targetPerson: this.getImportCell(row, ['指向人', 'targetPerson']) || null,
        requestId: this.getImportCell(row, ['request_id', 'requestId', 'request id']) || null,
        fixStatus: this.getImportCell(row, ['修复状态', 'fixStatus']) || null,
        status: this.resolveEnum(this.getImportCell(row, ['状态', 'status']), STATUS_BY_LABEL, 'open') as 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected',
        severity: this.resolveEnum(this.getImportCell(row, ['严重性', 'severity']), SEVERITY_BY_LABEL, 'major') as 'trivial' | 'minor' | 'major' | 'critical' | 'blocker',
        priority: this.resolveEnum(this.getImportCell(row, ['优先级', 'priority']), PRIORITY_BY_LABEL, 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        assigneeName: this.getImportCell(row, ['负责人', 'assigneeName']) || null,
        issueCreatedAt: this.getImportCell(row, ['问题创建时间', 'issueCreatedAt']) || null,
        lastModifiedAt: this.getImportCell(row, ['最新修改日期', 'lastModifiedAt']) || null,
        steps: this.getImportCell(row, ['备注复现步骤', '备注 / 复现步骤', '复现步骤', 'steps']) || null
      };

      try {
        if (Number.isInteger(id) && id > 0) {
          await this.prisma.bug.update({
            where: { id },
            data
          });
          updated += 1;
          results.push({ row: rowNumber, id, title, status: 'success', message: '已更新' });
        } else {
          const createdBug = await this.prisma.bug.create({
            data: {
              projectId,
              ...data,
              reporterId: actorId || null,
              reporterName: actorUser?.name ?? null,
              organizationId: project?.organizationId ?? null
            }
          });
          created += 1;
          results.push({ row: rowNumber, id: createdBug.id, title, status: 'success', message: '已创建' });
        }
      } catch (e) {
        results.push({ row: rowNumber, id: Number.isInteger(id) ? id : undefined, title, status: 'failed', message: e instanceof Error ? e.message : '写入失败' });
      }
    }

    return {
      summary: {
        total: rows.length,
        success: results.filter((item) => item.status === 'success').length,
        failed: results.filter((item) => item.status === 'failed').length,
        skipped: results.filter((item) => item.status === 'skipped').length,
        created,
        updated
      },
      results
    };
  }

  async create(actor: AuthActor | undefined, dto: CreateBugDto) {
    await this.accessService.assertProjectAccess(actor, dto.projectId);
    const actorId = Number(actor?.sub);
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { organizationId: true }
    });
    const actorUser = actorId
      ? await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })
      : null;

    return this.prisma.bug.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        steps: dto.steps,
        clientContext: dto.clientContext,
        memoryContext: dto.memoryContext,
        expectedResult: dto.expectedResult,
        actualResult: dto.actualResult,
        targetPerson: dto.targetPerson,
        requestId: dto.requestId,
        fixStatus: dto.fixStatus,
        issueCreatedAt: dto.issueCreatedAt,
        lastModifiedAt: dto.lastModifiedAt,
        severity: dto.severity ?? 'major',
        priority: dto.priority ?? 'medium',
        status: 'open',
        testCaseId: dto.testCaseId,
        assigneeId: dto.assigneeId,
        assigneeName: dto.assigneeName,
        reporterId: actorId || null,
        reporterName: actorUser?.name ?? null,
        organizationId: project?.organizationId ?? null
      }
    });
  }

  async update(actor: AuthActor | undefined, id: number, dto: UpdateBugDto) {
    const item = await this.prisma.bug.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);

    const data: Record<string, unknown> = { ...dto };

    // Auto-set resolvedAt / closedAt based on status transitions
    if (dto.status === 'resolved' && item.status !== 'resolved') {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'closed' && item.status !== 'closed') {
      data.closedAt = new Date();
    }

    return this.prisma.bug.update({
      where: { id },
      data
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.bug.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    await this.prisma.bug.delete({ where: { id } });
    return { success: true };
  }
}
