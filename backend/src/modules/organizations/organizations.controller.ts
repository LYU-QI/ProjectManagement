import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Req, UseGuards
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/invite-member.dto';

@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Get()
  async list(@Req() req: { user: { sub: number } }) {
    return this.orgService.listForUser(req.user.sub);
  }

  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: Record<string, unknown>
  ) {
    return this.orgService.create(dto, req.user as { sub?: number; role?: string });
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>
  ) {
    const org = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.findById(id, org?.id ?? null);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.update(id, dto, actorOrg?.orgRole ?? null);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.delete(id, actorOrg?.orgRole ?? null);
  }

  @Get(':id/members')
  async listMembers(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.listMembers(id, actorOrg?.id ?? null);
  }

  @Post(':id/members/invite')
  async inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.inviteMember(id, Number(dto.userId), dto.role ?? 'member', actorOrg?.orgRole ?? null);
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.updateMemberRole(id, Number(userId), dto.role, actorOrg?.orgRole ?? null);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Record<string, unknown>
  ) {
    const actorOrg = req.org as { id: string | null; orgRole: string | null } | undefined;
    return this.orgService.removeMember(id, Number(userId), actorOrg?.orgRole ?? null);
  }
}
