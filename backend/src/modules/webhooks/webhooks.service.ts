import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

const AVAILABLE_EVENTS = [
  'requirement.created',
  'requirement.updated',
  'requirement.status_changed',
  'workitem.created',
  'workitem.updated',
  'workitem.status_changed',
  'bug.created',
  'bug.updated',
  'project.created',
  'project.updated'
];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string | null) {
    if (!organizationId) return [];
    const rows = await this.prisma.orgWebhook.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      events: row.events,
      enabled: row.enabled,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async create(organizationId: string, dto: { name: string; url: string; secret?: string; events: string[] }) {
    const invalid = dto.events.filter((e) => !AVAILABLE_EVENTS.includes(e));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown events: ${invalid.join(', ')}. Available: ${AVAILABLE_EVENTS.join(', ')}`);
    }
    const secret = dto.secret || crypto.randomBytes(24).toString('hex');
    const row = await this.prisma.orgWebhook.create({
      data: {
        organizationId,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events
      }
    });
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      secret,
      events: row.events,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString()
    };
  }

  async update(id: string, organizationId: string, dto: { name?: string; url?: string; secret?: string; events?: string[]; enabled?: boolean }) {
    const existing = await this.prisma.orgWebhook.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Webhook not found');

    if (dto.events) {
      const invalid = dto.events.filter((e) => !AVAILABLE_EVENTS.includes(e));
      if (invalid.length > 0) {
        throw new BadRequestException(`Unknown events: ${invalid.join(', ')}`);
      }
    }

    const updated = await this.prisma.orgWebhook.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        url: dto.url ?? existing.url,
        secret: dto.secret !== undefined ? dto.secret : existing.secret,
        events: dto.events ?? existing.events,
        enabled: dto.enabled ?? existing.enabled
      }
    });
    return {
      id: updated.id,
      name: updated.name,
      url: updated.url,
      events: updated.events,
      enabled: updated.enabled,
      lastTriggeredAt: updated.lastTriggeredAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async delete(id: string, organizationId: string) {
    const existing = await this.prisma.orgWebhook.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.prisma.orgWebhook.delete({ where: { id } });
    return { success: true };
  }

  async getDeliveries(webhookId: string, organizationId: string | null, page: number, limit: number) {
    if (!organizationId) throw new BadRequestException('No organization context');
    const webhook = await this.prisma.orgWebhook.findFirst({ where: { id: webhookId, organizationId } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.orgWebhookDelivery.findMany({
        where: { webhookId },
        orderBy: { attemptedAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.orgWebhookDelivery.count({ where: { webhookId } })
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        event: row.event,
        statusCode: row.statusCode,
        success: row.success,
        response: row.response,
        error: row.error,
        attemptedAt: row.attemptedAt.toISOString()
      })),
      total,
      page,
      limit
    };
  }

  async testWebhook(id: string, organizationId: string) {
    const webhook = await this.prisma.orgWebhook.findFirst({ where: { id, organizationId } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' }
    };

    return this.sendWebhook(webhook, 'test', testPayload);
  }

  async triggerEvent(organizationId: string, event: string, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.orgWebhook.findMany({
      where: { organizationId, enabled: true, events: { has: event } }
    });

    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.sendWebhook(webhook, event, payload))
    );

    return {
      triggered: webhooks.length,
      results: results.map((r, i) => ({
        webhookId: webhooks[i].id,
        success: r.status === 'fulfilled' && r.value.success
      }))
    };
  }

  private async sendWebhook(
    webhook: { id: string; url: string; secret?: string | null; organizationId: string },
    event: string,
    payload: Record<string, unknown>
  ) {
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (webhook.secret) {
      const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }
    headers['X-Webhook-Event'] = event;

    let statusCode: number | null = null;
    let success = false;
    let response: string | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000)
      });
      statusCode = res.status;
      success = res.ok;
      response = await res.text().catch(() => null);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    await this.prisma.orgWebhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as any,
        statusCode,
        success,
        response,
        error
      }
    });

    if (success) {
      await this.prisma.orgWebhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() }
      }).catch(() => {});
    }

    return { success, statusCode, error };
  }
}
