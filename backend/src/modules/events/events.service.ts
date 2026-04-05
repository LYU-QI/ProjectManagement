import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

export interface AppEventPayload {
  type: string;
  organizationId?: string | null;
  projectId?: number | null;
  timestamp: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private readonly stream$ = new Subject<MessageEvent>();

  emit(type: string, payload: Omit<AppEventPayload, 'type' | 'timestamp'>) {
    this.stream$.next({
      type,
      data: {
        type,
        timestamp: new Date().toISOString(),
        ...payload
      } satisfies AppEventPayload
    });
  }

  streamForOrganization(organizationId?: string | null): Observable<MessageEvent> {
    const heartbeat$ = interval(15000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: {
          type: 'heartbeat',
          organizationId: organizationId ?? null,
          timestamp: new Date().toISOString()
        } satisfies AppEventPayload
      }))
    );

    const scoped$ = this.stream$.pipe(
      filter((event) => {
        const data = event.data as AppEventPayload | undefined;
        if (!organizationId) return true;
        if (!data?.organizationId) return true;
        return data.organizationId === organizationId;
      })
    );

    return merge(scoped$, heartbeat$);
  }
}
