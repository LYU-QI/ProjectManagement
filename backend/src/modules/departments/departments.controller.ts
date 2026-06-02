import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async list(@Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null; orgRole?: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.departmentsService.getDepartmentTree(actor, orgId, actorOrg?.orgRole ?? null);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null; orgRole?: string | null } | undefined;
    return this.departmentsService.getDepartmentById(actor, actorOrg?.id ?? '', actorOrg?.orgRole ?? null, id);
  }

  @Post()
  async create(@Body() body: { name: string; parentId?: string; sortOrder?: number }, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null; orgRole?: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.departmentsService.create(actor, orgId, actorOrg?.orgRole ?? null, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; parentId?: string | null; sortOrder?: number }, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null; orgRole?: string | null } | undefined;
    return this.departmentsService.update(actor, actorOrg?.id ?? '', actorOrg?.orgRole ?? null, id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null; orgRole?: string | null } | undefined;
    return this.departmentsService.delete(actor, actorOrg?.id ?? '', actorOrg?.orgRole ?? null, id);
  }
}
