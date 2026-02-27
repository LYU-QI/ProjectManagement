import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProjectsService } from './projects.service';
import { Roles } from '../auth/roles.decorator';

class CreateProjectDto {
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  ownerId!: number;

  @IsNumber()
  budget!: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  feishuChatIds?: string;
}

class UpdateProjectDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  feishuChatIds?: string;
}

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Req() req: { user?: { sub?: number; role?: string } }) {
    return this.projectsService.list(req.user);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post()
  create(@Body() body: CreateProjectDto) {
    return this.projectsService.create(body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.projectsService.update(id, body, req.user);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.projectsService.remove(id, req.user);
  }
}
