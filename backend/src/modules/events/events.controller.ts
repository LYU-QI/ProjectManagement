import { Controller, MessageEvent, Req, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('stream')
  stream(
    @Req() req: { org?: { id?: string | null } }
  ): Observable<MessageEvent> {
    return this.eventsService.streamForOrganization(req.org?.id ?? null);
  }
}
