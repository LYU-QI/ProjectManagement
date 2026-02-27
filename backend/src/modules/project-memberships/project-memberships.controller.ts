import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { IsIn, IsNumber } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { ProjectMembershipsService } from './project-memberships.service';

class CreateProjectMembershipDto {
  @IsNumber()
  userId!: number;

  @IsNumber()
  projectId!: number;

  @IsIn(['director', 'manager', 'member', 'viewer'])
  role!: 'director' | 'manager' | 'member' | 'viewer';
}

@Controller('api/v1/project-memberships')
export class ProjectMembershipsController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) { }

  @Roles('super_admin', 'project_director', 'lead')
  @Get()
  list(@Req() req: { user?: { sub?: number; role?: string } }) {
    return this.projectMembershipsService.list(req.user);
  }

  @Roles('super_admin', 'project_director', 'lead')
  @Post()
  create(
    @Body() body: CreateProjectMembershipDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.projectMembershipsService.create(req.user, body);
  }

  @Roles('super_admin', 'project_director', 'lead')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.projectMembershipsService.remove(req.user, id);
  }
}

