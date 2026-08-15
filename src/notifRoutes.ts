/** Deep-link notifications DotoHub mobile — aligné sur `core/contracts.py`. */

export type NotifLike = {
  type?: string;
  notif_type?: string;
  payload?: Record<string, unknown> | null;
  patient_id?: number;
};

const KIND_TO_TYPE: Record<string, string> = {
  consultation: "dossier_updated",
  consultation_annulee: "dossier_updated",
  ordonnance: "ordonnance",
  ordonnance_dispensee: "ordonnance",
  examen: "examen",
  examen_fichier: "examen",
  bon_examen: "bon_examen",
  bon_resultat: "examen",
  rdv_created: "appointment",
  rdv_pending: "appointment",
  rdv_confirmed: "appointment",
  rdv_updated: "appointment",
  rdv_annule: "appointment",
  insurance_updated: "dossier_updated",
  insurance_removed: "dossier_updated",
  access_request: "access_request",
};

export type HubNavTarget =
  | { screen: "Patient"; params: { patientId: number } }
  | { screen: "Agenda" }
  | { screen: "LaboFile" }
  | { screen: "UrgencePro"; params?: { patientId?: number } }
  | { screen: "Recherche" };

export function notificationTarget(n: NotifLike): HubNavTarget {
  const payload = (n.payload || n) as Record<string, unknown>;
  const kind = String(payload.kind || "");
  const type = KIND_TO_TYPE[kind] || n.type || n.notif_type || String(payload.type || "system");
  const patientId = Number(payload.patient_id ?? n.patient_id || 0) || null;

  if (type === "emergency" && patientId) {
    return { screen: "UrgencePro", params: { patientId } };
  }
  if (type === "appointment") return { screen: "Agenda" };
  if (type === "bon_examen" && !patientId) return { screen: "LaboFile" };
  if (patientId) return { screen: "Patient", params: { patientId } };
  if (type === "access_request") return { screen: "Recherche" };
  return { screen: "Recherche" };
}

let pendingPush: Record<string, unknown> | null = null;

export function takePendingPush() {
  const p = pendingPush;
  pendingPush = null;
  return p;
}

export function subscribePushNavigation(): () => void {
  let sub: { remove: () => void } | undefined;
  const handle = (data: Record<string, unknown>) => {
    pendingPush = data;
  };
  void (async () => {
    try {
      const Notifications = await import("expo-notifications");
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last?.notification?.request?.content?.data) {
        handle(last.notification.request.content.data as Record<string, unknown>);
      }
      sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        const data = resp.notification.request.content.data as Record<string, unknown>;
        if (data) handle(data);
      });
    } catch {
      /* module absent */
    }
  })();
  return () => sub?.remove();
}
