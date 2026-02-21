import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
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
  list(@Query('projectId') projectId?: string) {
    return this.costsService.list(projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead')
  @Post()
  create(@Body() body: CreateCostDto) {
    return this.costsService.create(body);
  }

  @Roles('pm', 'lead')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCostDto) {
    return this.costsService.update(id, body);
  }

  @Roles('pm', 'lead')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.costsService.remove(id);
  }

  @Get('summary')
  summary(@Query('projectId') projectId: string) {
    return this.costsService.summary(Number(projectId));
  }
}
