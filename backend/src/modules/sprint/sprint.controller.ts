import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { SprintService } from './sprint.service';
import { CreateSprintDto, ListSprintQueryDto, UpdateSprintDto } from './dto/sprint.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1')
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @Get('sprints')
  list(
    @Query() query: ListSprintQueryDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.sprintService.list(req.user, query);
  }

  @Get('sprints/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.sprintService.findOne(req.user, id);
  }

  @Roles('project_manager', 'pm', 'super_admin')
  @Post('sprints')
  create(
    @Body() body: CreateSprintDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.sprintService.create(req.user, body);
  }

  @Roles('project_manager', 'pm', 'super_admin')
  @Patch('sprints/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSprintDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.sprintService.update(req.user, id, body);
  }

  @Roles('project_manager', 'pm', 'super_admin')
  @Delete('sprints/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.sprintService.remove(req.user, id);
  }
}
