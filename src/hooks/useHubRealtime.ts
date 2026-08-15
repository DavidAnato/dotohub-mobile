/** SSE hub mobile — invalidation React Query + kick dossier si accès révoqué. */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { storage } from "../storage";
import { qk } from "../queries/keys";
import { useAppStore } from "../store/appStore";
import { connectSse } from "../sse";

export type HubMobileSseEvent = {
  type: string;
  patient_id?: number;
  npi?: string;
  full_name?: string;
  access_request_id?: number;
  emergency?: boolean;
  consent_required?: boolean;
  notification_id?: number;
  title?: string;
  body?: string;
  message?: string;
  close_dossier?: boolean;
  notif_type?: string;
  payload?: {
    patient_id?: number;
    section?: string;
    kind?: string;
    revoked?: boolean;
    close_dossier?: boolean;
    message?: string;
    [key: string]: unknown;
  };
  ts?: string;
};

const POLL_MS = 12_000;
const SSE_RETRY_MS = 5_000;

function invalidatePatientMedical(qc: QueryClient, patientId: number | string | undefined | null) {
  if (patientId == null || patientId === "") return;
  const id = String(patientId);
  void qc.invalidateQueries({ queryKey: qk.patient(id) });
  void qc.invalidateQueries({ queryKey: qk.consultations(Number(id) || id) });
  void qc.invalidateQueries({ queryKey: qk.ordonnances(Number(id) || id) });
  void qc.invalidateQueries({ queryKey: qk.examens(Number(id) || id) });
  void qc.invalidateQueries({ queryKey: qk.constantes(Number(id) || id) });
  void qc.invalidateQueries({ queryKey: ["ordonnances"] });
  void qc.invalidateQueries({ queryKey: ["labo-examens"] });
  void qc.invalidateQueries({ queryKey: ["appointments"] });
}

function kickPro(ev: HubMobileSseEvent) {
  const pid = Number(ev.patient_id ?? ev.payload?.patient_id);
  if (!Number.isFinite(pid)) return;
  const message =
    (typeof ev.message === "string" && ev.message) ||
    (typeof ev.payload?.message === "string" && ev.payload.message) ||
    ev.body ||
    "Accès révoqué par le patient. Le dossier se ferme.";
  useAppStore.getState().setAccessKick({ patientId: pid, message });
}

function handleHubEvent(qc: QueryClient, ev: HubMobileSseEvent) {
  if (!ev?.type || ev.type === "connected" || ev.type === "ping") return;

  const pid = ev.patient_id ?? ev.payload?.patient_id;

  if (ev.type === "notification") {
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    if (ev.payload?.revoked || ev.payload?.close_dossier) {
      kickPro(ev);
    }
  }

  if (
    ev.type === "appointment" ||
    ev.payload?.section === "rdv" ||
    String(ev.payload?.kind || "").startsWith("rdv")
  ) {
    void qc.invalidateQueries({ queryKey: ["appointments"] });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
  }

  if (
    ev.type === "insurance_updated" ||
    ev.payload?.section === "assurance" ||
    String(ev.payload?.kind || "").startsWith("insurance")
  ) {
    invalidatePatientMedical(qc, pid);
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    void qc.invalidateQueries({ queryKey: ["dodocards"] });
  }

  if (
    ev.type === "dossier_updated" ||
    ev.type === "ordonnance" ||
    ev.type === "examen" ||
    ev.notif_type === "ordonnance" ||
    ev.notif_type === "examen" ||
    ev.notif_type === "dossier_updated" ||
    ev.type === "notification"
  ) {
    invalidatePatientMedical(qc, pid);
    void qc.invalidateQueries({ queryKey: qk.dashboard });
  }

  if (ev.type === "patient_list") {
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    void qc.invalidateQueries({ queryKey: ["patients"] });
    invalidatePatientMedical(qc, pid);
  }

  if (ev.type === "access_granted" || ev.type === "dodocard_scan") {
    invalidatePatientMedical(qc, pid);
    void qc.invalidateQueries({ queryKey: qk.dashboard });
  }

  if (ev.type === "access_revoked" || ev.type === "access_expired") {
    invalidatePatientMedical(qc, pid);
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    kickPro(ev);
  }
}

/**
 * Temps réel DotoHub mobile : SSE (EventSource web + XHR natif) + poll léger en secours.
 * Ne remplace pas useConsentWait (flux consentement dédié).
 */
export function useHubRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const online = useAppStore((s) => s.online);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !online) return;

    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let appSub: { remove: () => void } | undefined;

    const tick = () => {
      if (closed || AppState.currentState !== "active") return;
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    };

    const connect = async () => {
      if (closed) return;
      const token = await storage.getAccess();
      if (!token || closed) return;
      closeRef.current?.();
      closeRef.current = connectSse(
        api.eventsUrl(token),
        (data) => {
          handleHubEvent(qc, data as HubMobileSseEvent);
        },
        {
          onError: () => {
            closeRef.current = null;
            if (!closed) retry = setTimeout(() => void connect(), SSE_RETRY_MS);
          },
        }
      );
    };

    tick();
    poll = setInterval(tick, POLL_MS);
    void connect();
    appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        tick();
        void connect();
      }
    });

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (poll) clearInterval(poll);
      appSub?.remove();
      closeRef.current?.();
      closeRef.current = null;
    };
  }, [enabled, online, qc]);
}
