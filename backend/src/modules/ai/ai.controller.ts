import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsNotEmpty } from 'class-validator';
import { AiService } from './ai.service';

class WeeklyReportDto {
  @IsArray()
  projectIds!: number[];

  @IsNotEmpty()
  weekStart!: string;

  @IsNotEmpty()
  weekEnd!: string;

  @IsBoolean()
  includeRisks!: boolean;

  @IsBoolean()
  includeBudget!: boolean;
}

@Controller('api/v1/ai/reports')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('weekly')
  weekly(@Body() body: WeeklyReportDto) {
    return this.aiService.weeklyReport(body);
  }
}
