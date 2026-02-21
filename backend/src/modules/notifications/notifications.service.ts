import { Injectable } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId?: number, unread?: boolean) {
    return this.prisma.notification.findMany({
      where: {
        projectId: projectId ?? undefined,
        readAt: unread ? null : undefined
      },
      orderBy: { id: 'desc' }
    });
  }

  async markRead(id: number) {
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
    return this.prisma.notification.create({
      data: {
        projectId: input.projectId,
        level: input.level ?? NotificationLevel.info,
        title: input.title,
        message: input.message
      }
    });
  }
}
