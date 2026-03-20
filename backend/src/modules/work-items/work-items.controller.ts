import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateWorkItemDto, UpdateWorkItemDto } from './work-items.dto';
import { WorkItemsService } from './work-items.service';

@Controller('api/v1/work-items')
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  list(
    @Query('projectId') projectId: string | undefined,
    @Query('scope') scope: 'project' | 'personal' | 'all' | undefined,
    @Query('status') status: 'open' | 'done' | undefined,
    @Query('type') type: 'todo' | 'issue' | undefined,
    @Query('priority') priority: 'low' | 'medium' | 'high' | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('assigneeName') assigneeName: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.workItemsService.list(req?.user, {
      projectId: projectId ? Number(projectId) : undefined,
      scope,
      status,
      type,
      priority,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      assigneeName,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Get(':id/history')
  history(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.workItemsService.getHistory(req?.user, id);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post()
  create(
    @Body() body: CreateWorkItemDto,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.workItemsService.create(req?.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateWorkItemDto,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.workItemsService.update(req?.user, id, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.workItemsService.remove(req?.user, id);
  }
}
