import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { AutomationService } from './automation.service';

@Controller('api/v1/automations')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  async list(@Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.automationService.list(actor, orgId);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.findById(actor, id);
  }

  @Post()
  async create(
    @Body() body: { name: string; description?: string; trigger: string; conditions?: unknown; actions?: unknown; enabled?: boolean },
    @Req() req: Record<string, unknown>
  ) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    const actorOrg = req.org as { id: string | null } | undefined;
    const orgId = actorOrg?.id ?? '';
    return this.automationService.create(actor, orgId, {
      name: body.name,
      description: body.description,
      trigger: body.trigger as any,
      conditions: body.conditions ?? [],
      actions: body.actions ?? [],
      enabled: body.enabled ?? true
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; trigger?: string; conditions?: unknown; actions?: unknown; enabled?: boolean },
    @Req() req: Record<string, unknown>
  ) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.update(actor, id, {
      name: body.name,
      description: body.description,
      trigger: body.trigger as any,
      conditions: body.conditions,
      actions: body.actions,
      enabled: body.enabled
    });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.delete(actor, id);
  }

  @Post(':id/run')
  async run(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.testRule(actor, id, body.payload ?? {});
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.getLogs(actor, id);
  }

  @Post('test')
  async test(@Body() body: { ruleId: string; payload: unknown }, @Req() req: Record<string, unknown>) {
    const actor = req.user as { sub?: number; role?: string } | undefined;
    return this.automationService.testRule(actor, body.ruleId, body.payload);
  }
}
