import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { CostsService } from './costs.service';
import { Roles } from '../auth/roles.decorator';

class CreateCostDto {
  @IsNumber()
  projectId!: number;

  @IsIn(['labor', 'outsource', 'cloud'])
  type!: 'labor' | 'outsource' | 'cloud';

  @IsNumber()
  amount!: number;

  @IsNotEmpty()
  occurredOn!: string;

  note?: string;
}

class UpdateCostDto {
  @IsOptional()
  @IsIn(['labor', 'outsource', 'cloud'])
  type?: 'labor' | 'outsource' | 'cloud';

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsNotEmpty()
  occurredOn?: string;

  @IsOptional()
  note?: string;
}

@Controller('api/v1/cost-entries')
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get()
  list(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.costsService.list(req?.user, projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Post()
  create(@Body() body: CreateCostDto, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.costsService.create(req?.user, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCostDto,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.costsService.update(req?.user, id, body);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.costsService.remove(req?.user, id);
  }

  @Get('summary')
  summary(@Query('projectId') projectId: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.costsService.summary(req?.user, Number(projectId));
  }
}
