import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';
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

class ProgressReportDto {
  @IsNumber()
  projectId!: number;
}

@Controller('api/v1/ai/reports')
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post('weekly')
  weekly(@Body() body: WeeklyReportDto) {
    return this.aiService.weeklyReport(body);
  }

  /** 生成项目进展分析报告 */
  @Post('progress')
  progress(@Body() body: ProgressReportDto) {
    return this.aiService.progressReport(body);
  }
}
