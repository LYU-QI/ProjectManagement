import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { RisksService } from './risks.service';
import { ListAllRisksQueryDto, ListRisksQueryDto, UpdateRiskRuleDto } from './risks.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/risks')
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Get()
  async listRisks(@Query() query: ListRisksQueryDto) {
    return this.risksService.listRisks(query);
  }

  @Get('all')
  async listAll(@Query() query: ListAllRisksQueryDto) {
    return this.risksService.listAllRisks(query);
  }

  @Get('rules')
  async getRule() {
    return this.risksService.listRules();
  }

  @Put('rules')
  @Roles('pm', 'lead')
  async updateRule(@Body() body: UpdateRiskRuleDto) {
    return this.risksService.updateRule({
      key: body.key,
      thresholdDays: body.thresholdDays ? Number(body.thresholdDays) : undefined,
      progressThreshold: body.progressThreshold ? Number(body.progressThreshold) : undefined,
      includeMilestones: body.includeMilestones ? body.includeMilestones === 'true' : undefined,
      autoNotify: body.autoNotify ? body.autoNotify === 'true' : undefined,
      enabled: body.enabled ? body.enabled === 'true' : undefined,
      blockedValue: body.blockedValue
    });
  }

  @Get('rules/logs')
  async ruleLogs() {
    return this.risksService.listRuleLogs();
  }
}
