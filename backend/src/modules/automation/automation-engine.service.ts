import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationTrigger, AutomationAction } from '@prisma/client';

export interface TriggerPayload {
  organizationId: string;
  projectId?: number;
  requirementId?: number;
  requirementStatus?: string;
  workItemId?: number;
  workItemStatus?: string;
  bugId?: number;
  bugSeverity?: string;
  [key: string]: unknown;
}

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: unknown;
}

interface Action {
  type: AutomationAction;
  params: Record<string, unknown>;
}

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async trigger(event: string, payload: TriggerPayload): Promise<void> {
    const triggerMap: Record<string, string> = {
      'requirement.created': 'requirement_created',
      'requirement.status_changed': 'requirement_status_changed',
      'workitem.created': 'workitem_created',
      'workitem.status_changed': 'workitem_status_changed',
      'bug.created': 'bug_created',
      'bug.severity_critical': 'bug_severity_critical',
      'cost.over_budget': 'cost_over_budget',
      'milestone.due_soon': 'milestone_due_soon'
    };

    const trigger = triggerMap[event];
    if (!trigger) return;

    const rules = await this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        trigger: trigger as AutomationTrigger,
        organizationId: payload.organizationId
      }
    });

    for (const rule of rules) {
      try {
        await this.executeRule(rule, trigger, payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Automation rule ${rule.id} failed: ${message}`);
        await this.logExecution(rule.id, trigger, payload, [], false, message);
      }
    }
  }

  private async executeRule(
    rule: { id: string; name: string; conditions: unknown; actions: unknown },
    trigger: string,
    payload: TriggerPayload
  ): Promise<void> {
    const conditions = rule.conditions as Condition[];
    const actions = rule.actions as Action[];

    if (!this.evaluateConditions(conditions, payload)) {
      return;
    }

    const executedActions: string[] = [];
    for (const action of actions) {
      await this.executeAction(action, payload);
      executedActions.push(action.type);
    }

    await this.logExecution(rule.id, trigger, payload, executedActions, true, undefined);
  }

  private evaluateConditions(conditions: Condition[], payload: TriggerPayload): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every((cond) => {
      const value = this.getFieldValue(payload, cond.field);

      switch (cond.operator) {
        case 'equals':
          return value === cond.value;
        case 'not_equals':
          return value !== cond.value;
        case 'contains':
          return typeof value === 'string' && typeof cond.value === 'string' && value.includes(cond.value);
        case 'greater_than':
          return typeof value === 'number' && typeof cond.value === 'number' && value > cond.value;
        case 'less_than':
          return typeof value === 'number' && typeof cond.value === 'number' && value < cond.value;
        case 'exists':
          return value !== undefined && value !== null;
        case 'not_exists':
          return value === undefined || value === null;
        default:
          return true;
      }
    });
  }

  private getFieldValue(payload: TriggerPayload, field: string): unknown {
    const keys = field.split('.');
    let value: unknown = payload;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private async executeAction(action: Action, payload: TriggerPayload): Promise<void> {
    switch (action.type) {
      case 'send_notification':
        await this.sendNotification(action.params, payload);
        break;
      case 'send_webhook':
        await this.sendWebhook(action.params, payload);
        break;
      case 'update_status':
        await this.updateStatus(action.params, payload);
        break;
      case 'assign_to_user':
        await this.assignToUser(action.params, payload);
        break;
      case 'create_workitem':
        await this.createWorkItem(action.params, payload);
        break;
    }
  }

  private async sendNotification(params: Record<string, unknown>, payload: TriggerPayload): Promise<void> {
    const title = String(params.title ?? '自动化通知');
    const message = String(params.message ?? `触发事件: ${payload}`);

    await this.notificationsService.createSystemNotification({
      projectId: payload.projectId,
      level: (params.level as 'info' | 'warning' | 'error') ?? 'info',
      title,
      message
    });
  }

  private async sendWebhook(params: Record<string, unknown>, payload: TriggerPayload): Promise<void> {
    const url = String(params.url ?? '');
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'automation', payload })
      });
    } catch (err) {
      this.logger.warn(`Webhook failed: ${err}`);
    }
  }

  private async updateStatus(params: Record<string, unknown>, payload: TriggerPayload): Promise<void> {
    const { entityType, entityId, status } = params;
    if (!entityType || !entityId || !status) return;

    if (entityType === 'requirement' && payload.requirementId) {
      await this.prisma.requirement.update({
        where: { id: payload.requirementId },
        data: { status: status as any }
      });
    }

    if (entityType === 'workitem' && payload.workItemId) {
      await this.prisma.workItem.update({
        where: { id: payload.workItemId },
        data: { status: status as any }
      });
    }
  }

  private async assignToUser(params: Record<string, unknown>, payload: TriggerPayload): Promise<void> {
    const { entityType, assigneeName } = params;
    if (!entityType || !assigneeName) return;

    if (entityType === 'workitem' && payload.workItemId) {
      await this.prisma.workItem.update({
        where: { id: payload.workItemId },
        data: { assigneeName: String(assigneeName) }
      });
    }
  }

  private async createWorkItem(params: Record<string, unknown>, payload: TriggerPayload): Promise<void> {
    if (!payload.projectId) return;

    await this.prisma.workItem.create({
      data: {
        projectId: payload.projectId,
        title: String(params.title ?? '自动化创建'),
        description: String(params.description ?? ''),
        type: (params.type as any) ?? 'todo',
        priority: (params.priority as any) ?? 'medium',
        creatorId: 1
      }
    });
  }

  private async logExecution(
    ruleId: string,
    trigger: string,
    payload: TriggerPayload,
    actionsRun: string[],
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.automationLog.create({
        data: {
          ruleId,
          trigger,
          payload: payload as unknown as object,
          actionsRun: actionsRun as unknown as object,
          success,
          error: error ?? null
        }
      });
    } catch (err) {
      this.logger.warn(`Failed to log automation execution: ${err}`);
    }
  }
}
