import { useEffect, useRef } from 'react';
import { API_BASE, TOKEN_KEY } from '../api/client';

export interface AppStreamEvent {
  type: string;
  organizationId?: string | null;
  projectId?: number | null;
  timestamp: string;
  payload?: Record<string, unknown>;
}

interface UseEventStreamOptions {
  enabled: boolean;
  eventTypes: string[];
  onEvent: (event: AppStreamEvent) => void;
}

export default function useEventStream({ enabled, eventTypes, onEvent }: UseEventStreamOptions) {
  const onEventRef = useRef(onEvent);
  const eventTypesKey = eventTypes.join('|');

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const url = new URL(`${API_BASE}/events/stream`, window.location.origin);
    url.searchParams.set('access_token', token);
    const activeOrgId = localStorage.getItem('activeOrgId');
    if (activeOrgId) {
      url.searchParams.set('orgId', activeOrgId);
    }

    const source = new EventSource(url.toString());
    const cleanups = eventTypes.map((eventType) => {
      const listener = (event: MessageEvent<string>) => {
        try {
          onEventRef.current(JSON.parse(event.data) as AppStreamEvent);
        } catch {
          // ignore malformed events
        }
      };
      source.addEventListener(eventType, listener as EventListener);
      return () => source.removeEventListener(eventType, listener as EventListener);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      source.close();
    };
  }, [enabled, eventTypesKey]);
}
