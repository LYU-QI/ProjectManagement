import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Req, ForbiddenException, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditableRequest } from '../../audit/audit.types';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto, UpdateMemberDepartmentDto, UpdateMemberRoleDto } from './dto/invite-member.dto';
import { Public } from '../auth/public.decorator';
import { SkipOrgGuard } from '../auth/skip-org-guard.decorator';

@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @SkipOrgGuard()
  @Get()
  async list(@Req() req: { user: { sub: number } }) {
    return this.orgService.listForUser(req.user.sub);
  }

  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: AuditableRequest
  ) {
    return this.orgService.create(dto, req.user as { sub?: number; role?: string }, req);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>
  ) {
    const actor = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    if (globalRole !== 'super_admin' && actor?.id !== null && actor?.id !== id) {
      throw new ForbiddenException('Access denied to this organization');
    }
    return this.orgService.findById(id, actor?.id ?? null);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.update(id, dto, actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.delete(id, actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Get(':id/members')
  async listMembers(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.listMembers(id, actorOrg?.id ?? null, globalRole);
  }

  @Post(':id/members/invite')
  async inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.inviteMember(id, Number(dto.userId), dto.role ?? 'member', actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.updateMemberRole(id, Number(userId), dto.role, actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Patch(':id/members/:userId/department')
  async updateMemberDepartment(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDepartmentDto,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.updateMemberDepartment(id, Number(userId), dto.departmentId ?? null, actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Post(':id/members/departments/import')
  @UseInterceptors(FileInterceptor('file'))
  async importMemberDepartments(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.importMemberDepartments(id, file, actorOrg?.orgRole ?? null, globalRole, req);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuditableRequest
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    return this.orgService.removeMember(id, Number(userId), actorOrg?.orgRole ?? null, globalRole, req);
  }
}
