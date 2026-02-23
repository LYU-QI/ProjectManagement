import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
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

/** 需求智能评审 DTO */
class ReviewRequirementDto {
  @IsNumber()
  id!: number;
}

/** 自然语言录入任务 DTO */
class ParseTaskDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsOptional()
  projectName?: string;
}

@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post('reports/weekly')
  weekly(@Body() body: WeeklyReportDto) {
    return this.aiService.weeklyReport(body);
  }

  /** 生成项目进展分析报告 */
  @Post('reports/progress')
  progress(@Body() body: ProgressReportDto) {
    return this.aiService.progressReport(body);
  }

  /** 需求智能评审 */
  @Post('requirements/review')
  reviewRequirement(@Body() body: ReviewRequirementDto) {
    return this.aiService.reviewRequirement(body);
  }

  /** 自然语言解析任务 */
  @Post('tasks/parse')
  parseTask(@Body() body: ParseTaskDto) {
    return this.aiService.parseTaskFromText(body);
  }
}
