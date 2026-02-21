import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query('projectId') projectId?: string, @Query('unread') unread?: string) {
    return this.notificationsService.list(
      projectId ? Number(projectId) : undefined,
      unread === 'true'
    );
  }

  @Post(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markRead(id);
  }
}
