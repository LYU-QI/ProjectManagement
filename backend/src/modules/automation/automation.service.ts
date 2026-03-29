import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngineService } from './automation-engine.service';
import { AccessService, AuthActor } from '../access/access.service';
import { AutomationRule, AutomationTrigger } from '@prisma/client';

interface CreateRuleInput {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: unknown;
  actions: unknown;
  enabled?: boolean;
}

interface UpdateRuleInput {
  name?: string;
  description?: string;
  trigger?: AutomationTrigger;
  conditions?: unknown;
  actions?: unknown;
  enabled?: boolean;
}

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automationEngine: AutomationEngineService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, organizationId: string) {
    return this.prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(actor: AuthActor | undefined, id: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: { logs: { orderBy: { executionAt: 'desc' }, take: 50 } }
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return rule;
  }

  async create(actor: AuthActor | undefined, organizationId: string, input: CreateRuleInput) {
    return this.prisma.automationRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        trigger: input.trigger,
        conditions: input.conditions ?? [],
        actions: input.actions ?? [],
        enabled: input.enabled ?? true,
        organizationId
      }
    });
  }

  async update(actor: AuthActor | undefined, id: string, input: UpdateRuleInput) {
    const existing = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Automation rule not found');
    }

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description ?? null : existing.description,
        trigger: input.trigger ?? existing.trigger,
        conditions: (input.conditions ?? existing.conditions) as object,
        actions: (input.actions ?? existing.actions) as object,
        enabled: input.enabled ?? existing.enabled
      }
    });
  }

  async delete(actor: AuthActor | undefined, id: string) {
    const existing = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Automation rule not found');
    }

    await this.prisma.automationLog.deleteMany({ where: { ruleId: id } });
    return this.prisma.automationRule.delete({ where: { id } });
  }

  async getLogs(actor: AuthActor | undefined, ruleId: string) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return this.prisma.automationLog.findMany({
      where: { ruleId },
      orderBy: { executionAt: 'desc' },
      take: 100
    });
  }

  async testRule(actor: AuthActor | undefined, ruleId: string, testPayload: unknown) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    try {
      await this.automationEngine.trigger(
        this.mapTriggerToEvent(rule.trigger),
        testPayload as any
      );
      return { success: true, message: 'Test execution completed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  private mapTriggerToEvent(trigger: AutomationTrigger): string {
    const map: Record<AutomationTrigger, string> = {
      requirement_created: 'requirement.created',
      requirement_status_changed: 'requirement.status_changed',
      workitem_created: 'workitem.created',
      workitem_status_changed: 'workitem.status_changed',
      bug_created: 'bug.created',
      bug_severity_critical: 'bug.severity_critical',
      cost_over_budget: 'cost.over_budget',
      milestone_due_soon: 'milestone.due_soon'
    };
    return map[trigger] ?? trigger;
  }
}
