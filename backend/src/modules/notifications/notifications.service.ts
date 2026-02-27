import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { ConfigService } from '../config/config.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly feishuService: FeishuService,
    private readonly configService: ConfigService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, projectId?: number, unread?: boolean) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.notification.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            OR: [
              { projectId: null },
              { projectId: { in: accessible } }
            ]
          }),
        readAt: unread ? null : undefined
      },
      orderBy: { id: 'desc' }
    });
  }

  async markRead(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, projectId: true }
    });
    if (!target) {
      throw new NotFoundException('Notification not found');
    }
    if (target.projectId) {
      await this.accessService.assertProjectAccess(actor, target.projectId);
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() }
    });
  }

  async createSystemNotification(input: {
    projectId?: number;
    level?: NotificationLevel;
    title: string;
    message: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        projectId: input.projectId,
        level: input.level ?? NotificationLevel.info,
        title: input.title,
        message: input.message
      }
    });
    void this.sendToFeishu(notification.projectId ?? undefined, notification.title, notification.message, notification.level);
    return notification;
  }

  private parseChatIds(raw?: string | null) {
    if (!raw) return [];
    return raw
      .split(/[,;\n]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private buildCard(title: string, message: string, level: NotificationLevel, projectName?: string) {
    const colorMap: Record<NotificationLevel, string> = {
      info: 'blue',
      warning: 'orange',
      error: 'red'
    };
    const headerTitle = projectName ? `${projectName}·${title}` : title;
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: headerTitle },
        template: colorMap[level] || 'blue'
      },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: message } },
        { tag: 'hr' },
        { tag: 'div', text: { tag: 'plain_text', content: `来源：项目管理系统` } }
      ]
    };
  }

  private async sendToFeishu(projectId: number | undefined, title: string, message: string, level: NotificationLevel) {
    try {
      let chatIds: string[] = [];
      let projectName: string | undefined;
      if (projectId) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        chatIds = this.parseChatIds(project?.feishuChatIds);
        projectName = project?.name;
      }
      if (chatIds.length === 0) {
        chatIds = this.parseChatIds(this.configService.getRawValue('FEISHU_CHAT_ID'));
      }
      if (chatIds.length === 0) return;
      const card = this.buildCard(title, message, level, projectName);
      await Promise.all(chatIds.map((id) => this.feishuService.sendInteractiveMessage({
        receiveId: id,
        receiveIdType: 'chat_id',
        card
      })));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to push Feishu notification: ${detail}`);
    }
  }
}
