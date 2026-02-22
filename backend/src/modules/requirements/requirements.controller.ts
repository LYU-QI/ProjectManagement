import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { RequirementsService } from './requirements.service';
import { Roles } from '../auth/roles.decorator';

class CreateRequirementDto {
  @IsNumber()
  projectId!: number;

  @IsNotEmpty()
  title!: string;

  @IsNotEmpty()
  description!: string;

  @IsIn(['low', 'medium', 'high'])
  priority!: 'low' | 'medium' | 'high';

  @IsOptional()
  version?: string;
}

class ReviewRequirementDto {
  @IsNotEmpty()
  reviewer!: string;

  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  comment?: string;
}

class ChangeRequirementDto {
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  version?: string;

  @IsOptional()
  reason?: string;

  @IsOptional()
  changedBy?: string;
}

class UpdateRequirementDto {
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['draft', 'in_review', 'approved', 'planned', 'done'])
  status?: 'draft' | 'in_review' | 'approved' | 'planned' | 'done';

  @IsOptional()
  version?: string;
}

@Controller('api/v1/requirements')
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.requirementsService.list(projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead')
  @Post()
  create(@Body() body: CreateRequirementDto) {
    return this.requirementsService.create(body);
  }

  @Roles('pm', 'lead')
  @Post(':id/review')
  review(@Param('id', ParseIntPipe) id: number, @Body() body: ReviewRequirementDto) {
    return this.requirementsService.review(id, body.reviewer, body.decision, body.comment);
  }

  @Roles('pm', 'lead')
  @Post(':id/change')
  change(@Param('id', ParseIntPipe) id: number, @Body() body: ChangeRequirementDto) {
    return this.requirementsService.change(id, body.description, body.version, body.reason, body.changedBy);
  }

  @Get(':id/changes')
  changes(@Param('id', ParseIntPipe) id: number) {
    return this.requirementsService.listChanges(id);
  }

  @Roles('pm', 'lead')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRequirementDto) {
    return this.requirementsService.update(id, body);
  }

  @Roles('pm', 'lead')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.requirementsService.remove(id);
  }
}
