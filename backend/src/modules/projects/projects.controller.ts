import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
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
  list() {
    return this.projectsService.list();
  }

  @Roles('pm', 'lead')
  @Post()
  create(@Body() body: CreateProjectDto) {
    return this.projectsService.create(body);
  }

  @Roles('pm', 'lead')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProjectDto) {
    return this.projectsService.update(id, body);
  }

  @Roles('pm', 'lead')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }
}
