import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { SmartFillService } from './smart-fill.service';

class GenerateRequirementDto {
  @IsString()
  brief!: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

@Controller('api/v1/smart-fill')
export class SmartFillController {
  constructor(private readonly smartFillService: SmartFillService) {}

  @Post('requirement')
  generateRequirement(@Body() body: GenerateRequirementDto, @Req() req: any) {
    const projectId = body.projectId ? parseInt(body.projectId, 10) : undefined;
    return this.smartFillService.generateRequirement(body.brief, projectId);
  }

  @Post('prd')
  generatePrd(@Body() body: { requirementId: number }, @Req() req: any) {
    return this.smartFillService.generatePrd(body.requirementId);
  }

  @Post('work-items')
  suggestWorkItems(@Body() body: { requirementId: number; projectId: number }, @Req() req: any) {
    return this.smartFillService.suggestWorkItems(body.requirementId, body.projectId);
  }
}
