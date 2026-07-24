/** Attente consentement patient — SSE (si dispo) + poll access-request. */
import { useEffect, useRef } from "react";
import { api } from "../api";
import { storage } from "../storage";

export type HubSseEvent = {
  type: string;
  patient_id?: number;
  npi?: string;
  full_name?: string;
  access_request_id?: number;
  emergency?: boolean;
};

export type ConsentOutcome =
  | { kind: "granted"; patientId: number; emergency?: boolean }
  | { kind: "denied" }
  | { kind: "cancelled" }
  | { kind: "expired" };

const POLL_MS = 3500;
const SSE_RETRY_MS = 4000;

const GRANTED_STATUSES = new Set(["approved", "emergency_bypass"]);
const DENIED_STATUSES = new Set(["denied"]);
const CANCELLED_STATUSES = new Set(["cancelled"]);
const EXPIRED_STATUSES = new Set(["expired", "revoked"]);

function outcomeFromStatus(status: string, patientId: number): ConsentOutcome | null {
  if (GRANTED_STATUSES.has(status)) {
    return {
      kind: "granted",
      patientId,
      emergency: status === "emergency_bypass",
    };
  }
  if (DENIED_STATUSES.has(status)) return { kind: "denied" };
  if (CANCELLED_STATUSES.has(status)) return { kind: "cancelled" };
  if (EXPIRED_STATUSES.has(status)) return { kind: "expired" };
  return null;
}

function outcomeFromSse(
  ev: HubSseEvent,
  opts: { patientId: number; accessRequestId?: number }
): ConsentOutcome | null {
  if (opts.accessRequestId != null && ev.access_request_id != null) {
    if (ev.access_request_id !== opts.accessRequestId) return null;
  } else if (ev.patient_id != null && ev.patient_id !== opts.patientId) {
    return null;
  }

  if (ev.type === "access_granted") {
    return {
      kind: "granted",
      patientId: ev.patient_id ?? opts.patientId,
      emergency: !!ev.emergency,
    };
  }
  if (ev.type === "access_denied") return { kind: "denied" };
  if (ev.type === "access_cancelled") return { kind: "cancelled" };
  if (ev.type === "access_expired" || ev.type === "access_revoked") {
    return { kind: "expired" };
  }
  return null;
}

/**
 * Surveille la demande d'accès jusqu'à résolution.
 * - EventSource via `api.eventsUrl` quand disponible (Expo web / polyfill).
 * - Poll `GET /api/access-requests/:id/` toutes les ~3,5 s en secours (natif).
 */
export function useConsentWait(
  enabled: boolean,
  opts: { patientId: number; accessRequestId?: number },
  onOutcome: (outcome: ConsentOutcome) => void
) {
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;

  useEffect(() => {
    if (!enabled || !opts.patientId) return;

    let closed = false;
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let sseRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let es: EventSource | null = null;

    const settle = (outcome: ConsentOutcome) => {
      if (closed || settled) return;
      settled = true;
      onOutcomeRef.current(outcome);
    };

    const pollOnce = async () => {
      if (closed || settled || opts.accessRequestId == null) return;
      try {
        const data = await api.accessRequest(opts.accessRequestId);
        const status = String(data?.status || "");
        const patientId = Number(data?.patient_id ?? opts.patientId);
        const outcome = outcomeFromStatus(status, patientId);
        if (outcome) settle(outcome);
      } catch {
        /* ignore transient poll errors */
      }
    };

    const connectSse = async () => {
      if (closed || settled) return;
      if (typeof EventSource === "undefined") return;

      const token = await storage.getAccess();
      if (!token || closed || settled) return;

      try {
        es?.close();
        es = new EventSource(api.eventsUrl(token));
        es.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data) as HubSseEvent;
            const outcome = outcomeFromSse(data, opts);
            if (outcome) settle(outcome);
          } catch {
            /* ignore malformed */
          }
        };
        es.onerror = () => {
          es?.close();
          es = null;
          if (closed || settled) return;
          sseRetryTimer = setTimeout(() => {
            void connectSse();
          }, SSE_RETRY_MS);
        };
      } catch {
        /* EventSource unavailable — poll only */
      }
    };

    void connectSse();
    void pollOnce();
    pollTimer = setInterval(() => {
      void pollOnce();
    }, POLL_MS);

    return () => {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (sseRetryTimer) clearTimeout(sseRetryTimer);
      es?.close();
    };
  }, [enabled, opts.patientId, opts.accessRequestId]);
}
