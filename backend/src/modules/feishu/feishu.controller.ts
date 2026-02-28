import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { FeishuService } from './feishu.service';
import { ListRecordsQueryDto } from './feishu.dto';
import { Roles } from '../auth/roles.decorator';
import { RisksService } from '../risks/risks.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../../database/prisma.service';

@Controller('api/v1/feishu')
export class FeishuController {
  constructor(
    private readonly feishuService: FeishuService,
    private readonly risksService: RisksService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService
  ) { }

  private async getAllowedProjectNames(actor?: { sub?: number; role?: string }) {
    const ids = await this.accessService.getAccessibleProjectIds(actor);
    if (ids === null) return null;
    if (ids.length === 0) return new Set<string>();
    const projects = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      select: { name: true }
    });
    const set = new Set<string>();
    for (const project of projects) {
      const name = String(project.name || '').trim();
      if (!name) continue;
      set.add(name);
      set.add(name.toLowerCase());
    }
    return set;
  }

  private assertProjectAllowed(projectName: unknown, allowedProjectNames: Set<string> | null) {
    if (allowedProjectNames === null) return;
    const value = String(projectName ?? '').trim();
    if (!value) {
      throw new ForbiddenException('缺少所属项目或无权限写入该项目');
    }
    if (!allowedProjectNames.has(value) && !allowedProjectNames.has(value.toLowerCase())) {
      throw new ForbiddenException(`无权限访问项目：${value}`);
    }
  }

  @Get('records')
  async listRecords(
    @Query() query: ListRecordsQueryDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const allowedProjectNames = await this.getAllowedProjectNames(req.user);
    return this.feishuService.listRecords({
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      pageToken: query.pageToken,
      viewId: query.viewId,
      filter: query.filter,
      sort: query.sort,
      fieldNames: query.fieldNames,
      textFieldAsArray: query.textFieldAsArray ? query.textFieldAsArray === 'true' : undefined,
      displayFormulaRef: query.displayFormulaRef ? query.displayFormulaRef === 'true' : undefined,
      automaticFields: query.automaticFields ? query.automaticFields === 'true' : undefined,
      userIdType: query.userIdType,
      search: query.search,
      searchFields: query.searchFields,
      filterProject: query.filterProject,
      filterStatus: query.filterStatus,
      filterAssignee: query.filterAssignee,
      filterRisk: query.filterRisk,
      allowedProjectNames
    });
  }

  @Post('records')
  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  async createRecord(
    @Body('fields') fields: Record<string, unknown>,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const allowedProjectNames = await this.getAllowedProjectNames(req.user);
    this.assertProjectAllowed(fields?.['所属项目'], allowedProjectNames);
    const result = await this.feishuService.createRecord(fields || {});
    const project = typeof fields?.['所属项目'] === 'string' ? fields['所属项目'] : undefined;
    await this.risksService.triggerAutoNotify(project);
    return result;
  }

  @Put('records/:recordId')
  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  async updateRecord(
    @Param('recordId') recordId: string,
    @Body('fields') fields: Record<string, unknown>,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const allowedProjectNames = await this.getAllowedProjectNames(req.user);
    const current = await this.feishuService.getRecord(recordId);
    this.assertProjectAllowed(current?.fields?.['所属项目'], allowedProjectNames);
    if (fields && Object.prototype.hasOwnProperty.call(fields, '所属项目')) {
      this.assertProjectAllowed(fields['所属项目'], allowedProjectNames);
    }
    const result = await this.feishuService.updateRecord(recordId, fields || {});
    const project = typeof fields?.['所属项目'] === 'string' ? fields['所属项目'] : undefined;
    await this.risksService.triggerAutoNotify(project);
    return result;
  }

  @Delete('records/:recordId')
  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  async deleteRecord(
    @Param('recordId') recordId: string,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const allowedProjectNames = await this.getAllowedProjectNames(req.user);
    const current = await this.feishuService.getRecord(recordId);
    this.assertProjectAllowed(current?.fields?.['所属项目'], allowedProjectNames);
    return this.feishuService.deleteRecord(recordId);
  }
}
