import { Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('unread') unread?: string,
    @Req() req?: { user?: { sub?: number; role?: string } }
  ) {
    return this.notificationsService.list(
      req?.user,
      projectId ? Number(projectId) : undefined,
      unread === 'true'
    );
  }

  @Post(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.notificationsService.markRead(req?.user, id);
  }
}
