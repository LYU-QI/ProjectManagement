import { Body, Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @IsOptional()
  projectName?: string;
}

/** 会议纪要解析任务 DTO */
class ParseMeetingDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

/** Dashboard 摘要 DTO */
class DashboardSummaryDto {
  @IsNumber()
  @IsOptional()
  projectId?: number;
}

/** 风险预测 DTO */
class RiskPredictDto {
  @IsNumber()
  @IsOptional()
  projectId?: number;
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

  /** 会议纪要智能提取 Action Items */
  @Post('tasks/parse-meeting')
  parseMeeting(@Body() body: ParseMeetingDto) {
    return this.aiService.parseMeetingText(body);
  }

  /** 获取仪表盘 AI 智能摘要 */
  @Post('dashboard/summary')
  getDashboardSummary(@Body() body: DashboardSummaryDto) {
    return this.aiService.getDashboardSummary(body);
  }

  /** 获取风险趋势预测 */
  @Post('risks/predict')
  getRiskPredict(@Body() body: RiskPredictDto) {
    return this.aiService.predictRisks(body);
  }

  /** 需求文档/Excel导入 */
  @Post('requirements/import')
  @UseInterceptors(FileInterceptor('file'))
  async importRequirements(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }
    return this.aiService.importRequirementsFromFile(file.buffer, file.originalname);
  }
}
