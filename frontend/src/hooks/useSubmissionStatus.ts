import { useEffect, useRef, useState } from 'react';

import { getSubmission } from '../api/submissionsApi';
import { useAuthStore } from '../store/authStore';

export interface SubmissionStatus {
  submission_id?: number;
  status: 'pending' | 'judging' | 'done' | 'error';
  verdict: string | null;
  time_ms: number | null;
  memory_kb: number | null;
}

/**
 * Resolve the WebSocket origin for submission status updates.
 *
 * - `VITE_WS_URL` (build-time) wins when set: full `ws://host` / `wss://host`
 *   origin, or a bare `host[:port]` (protocol picked from the page).
 * - Otherwise the page origin is used: same host and port over `wss://` on
 *   HTTPS pages and `ws://` otherwise. Never hardcodes localhost or port 80:
 *   development relies on the Vite `/ws` proxy, production on the reverse
 *   proxy on the same public host.
 */
function wsOrigin(): string {
  const configured = (import.meta.env.VITE_WS_URL ?? '').trim();
  const pageProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (configured) {
    if (/^wss?:\/\//i.test(configured)) {
      return configured.replace(/\/+$/, '');
    }
    return `${pageProtocol}//${configured.replace(/\/+$/, '')}`;
  }
  return `${pageProtocol}//${window.location.host}`;
}

function buildWsUrl(submissionId: number, token: string): string {
  const params = new URLSearchParams({ token });
  return `${wsOrigin()}/ws/submissions/${submissionId}/?${params}`;
}

function mapPayload(data: Record<string, unknown>): SubmissionStatus {
  return {
    submission_id: data.submission_id as number | undefined,
    status: data.status as SubmissionStatus['status'],
    verdict: (data.verdict as string | null) ?? null,
    time_ms: (data.time_ms as number | null) ?? null,
    memory_kb: (data.memory_kb as number | null) ?? null,
  };
}

export function useSubmissionStatus(submissionId: number | null) {
  const [status, setStatus] = useState<SubmissionStatus | null>(null);
  const [wsFailed, setWsFailed] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!submissionId) {
      return undefined;
    }

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      return undefined;
    }

    setWsFailed(false);
    let closedByApp = false;

    const connect = () => {
      const ws = new WebSocket(buildWsUrl(submissionId, token));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const next = mapPayload(data);
        setStatus(next);
        if (next.status === 'done' || next.status === 'error') {
          closedByApp = true;
          ws.close();
        }
      };

      ws.onerror = () => {
        console.error('WebSocket error for submission', submissionId);
      };

      ws.onclose = () => {
        if (closedByApp) {
          return;
        }
        // One automatic reconnect; after that the HTTP polling fallback takes over.
        reconnectRef.current += 1;
        if (reconnectRef.current <= 1) {
          setTimeout(() => {
            if (!closedByApp) {
              connect();
            }
          }, 1500);
        } else {
          setWsFailed(true);
        }
      };
    };

    connect();

    return () => {
      closedByApp = true;
      wsRef.current?.close();
    };
  }, [submissionId]);

  return { status, wsFailed };
}

export function useSubmissionStatusPolling(
  submissionId: number | null,
  enabled: boolean,
) {
  const [status, setStatus] = useState<SubmissionStatus | null>(null);

  useEffect(() => {
    if (!submissionId || !enabled) {
      return undefined;
    }

    let active = true;

    const poll = async () => {
      try {
        const data = await getSubmission(submissionId);
        if (!active) {
          return;
        }
        setStatus({
          submission_id: data.id,
          status: data.status,
          verdict: data.verdict,
          time_ms: data.time_ms,
          memory_kb: data.memory_kb,
        });
        if (data.status === 'done' || data.status === 'error') {
          active = false;
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [submissionId, enabled]);

  return status;
}
