import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { MilestoneBoardService } from './milestone-board.service';
import { Roles } from '../auth/roles.decorator';

class CreateItemDto {
  @IsNumber()
  projectId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  owner!: string;

  @IsString()
  @IsNotEmpty()
  due!: string;

  @IsOptional()
  @IsString()
  status?: 'upcoming' | 'in_progress' | 'completed';

  @IsOptional()
  @IsString()
  risk?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  deliverables?: Array<{ content: string; done?: boolean }>;
}

class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  owner?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  due?: string;

  @IsOptional()
  @IsString()
  status?: 'upcoming' | 'in_progress' | 'completed';

  @IsOptional()
  @IsString()
  risk?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  progress?: number;
}

class AddDeliverableDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

class UpdateDeliverableDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

class ImportDto {
  migrationToken?: string;
  items!: Array<{
    title: string;
    owner: string;
    due: string;
    status?: string;
    risk?: string;
    progress?: number;
    deliverables?: Array<{ content: string; done?: boolean }>;
  }>;
}

@Controller('api/v1')
export class MilestoneBoardController {
  constructor(private readonly milestoneBoardService: MilestoneBoardService) {}

  @Get('projects/:projectId/milestone-board')
  listByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.listByProject(req.user, projectId);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post('milestone-board')
  create(
    @Body() body: CreateItemDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.create(req.user, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch('milestone-board/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateItemDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.update(req.user, id, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Delete('milestone-board/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.remove(req.user, id);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post('milestone-board/:id/deliverables')
  addDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddDeliverableDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.addDeliverable(req.user, id, body.content);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch('milestone-board/deliverables/:id')
  updateDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDeliverableDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.updateDeliverable(req.user, id, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Delete('milestone-board/deliverables/:id')
  removeDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.removeDeliverable(req.user, id);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post('milestone-board/import')
  importLocal(
    @Body() body: ImportDto & { projectId: number },
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.milestoneBoardService.importLocal(req.user, body.projectId, body);
  }
}
