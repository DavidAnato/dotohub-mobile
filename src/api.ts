import { ProUser } from "./theme";
import { storage, PatientCacheItem } from "./storage";

// Local : EXPO_PUBLIC_API_URL ou 127.0.0.1. Preview/prod EAS : URL Render.
const DEFAULT_HOST = "127.0.0.1";
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EAS_BUILD === "true"
    ? "https://doto-backend-71tk.onrender.com"
    : `http://${DEFAULT_HOST}:8000`);

/** Aligne les URLs média (souvent 127.0.0.1) sur l’hôte API de l’app. */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const media = new URL(url);
    const api = new URL(API_URL);
    media.protocol = api.protocol;
    media.host = api.host;
    return media.toString();
  } catch {
    return url;
  }
}

function normalizeUser(user: ProUser): ProUser {
  return {
    ...user,
    photo_url: resolveMediaUrl(user.photo_url) || user.photo_url || null,
  };
}

const SESSION_EXPIRED_MSG = "Session expirée, reconnectez-vous";

type SessionExpiredHandler = (message: string) => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;
let sessionExpiredLock = false;

/** Enregistré depuis App - clear session + retour Login. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  sessionExpiredHandler = handler;
}

async function notifySessionExpired() {
  if (sessionExpiredLock) return;
  sessionExpiredLock = true;
  try {
    await storage.clearSession();
    sessionExpiredHandler?.(SESSION_EXPIRED_MSG);
  } finally {
    setTimeout(() => {
      sessionExpiredLock = false;
    }, 800);
  }
}

async function tryRefresh(): Promise<boolean> {
  const refresh = await storage.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const nextRefresh = data.refresh || refresh;
    await storage.saveTokens(data.access, nextRefresh);
    return true;
  } catch {
    return false;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.getAccess();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const method = String(options.method || "GET").toUpperCase();
  const navOffline =
    typeof navigator !== "undefined" &&
    typeof navigator.onLine === "boolean" &&
    !navigator.onLine;
  if (
    navOffline &&
    (method === "POST" || method === "PATCH" || method === "PUT") &&
    path.startsWith("/api/") &&
    !path.includes("/auth/")
  ) {
    const { enqueueOffline } = await import("./offlineQueue");
    let body: unknown;
    try {
      body = options.body ? JSON.parse(String(options.body)) : undefined;
    } catch {
      body = undefined;
    }
    await enqueueOffline({ method: method as "POST" | "PATCH" | "PUT", path, body });
    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
  const headers = {
    ...(await authHeaders()),
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    const hadAuth = !!(await storage.getAccess()) || !!(await storage.getRefresh());
    if (await tryRefresh()) return request(path, options, false);
    if (hadAuth) await notifySessionExpired();
  }
  return res;
}

async function requestJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await request(path, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(formatApiError(data, `Erreur API (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatApiError(data: any, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "detail") continue;
    if (Array.isArray(val)) parts.push(`${key}: ${val.join(", ")}`);
    else if (typeof val === "string") parts.push(`${key}: ${val}`);
  }
  return parts.length ? parts.join(" · ") : fallback;
}

export const api = {
  url: API_URL,

  async login(username: string, password: string): Promise<ProUser> {
    const res = await fetch(`${API_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Identifiants invalides.");
    }
    const data = await res.json();
    await storage.saveTokens(data.access, data.refresh);
    const user = normalizeUser({
      ...(data.user as ProUser),
      pin_set: data.pin_set ?? data.user?.pin_set,
    });
    await storage.saveUser(user);
    return user;
  },

  async me(): Promise<ProUser | null> {
    const token = await storage.getAccess();
    if (!token) return null;
    const res = await request("/api/auth/me/");
    if (res.status === 401 || res.status === 403) {
      await storage.clearSession();
      return null;
    }
    if (!res.ok) return null;
    const raw = (await res.json()) as ProUser;
    const user = normalizeUser({ ...raw, pin_set: raw.pin_set });
    await storage.saveUser(user);
    return user;
  },

  async setPin(pin: string, oldPin?: string) {
    const res = await request("/api/auth/set-pin/", {
      method: "POST",
      body: JSON.stringify({ pin, old_pin: oldPin || "" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Impossible d'enregistrer le PIN.");
    }
    await storage.saveLocalPin(pin);
    return res.json();
  },

  async verifyPin(pin: string) {
    if (await storage.matchLocalPin(pin)) {
      void request("/api/auth/verify-pin/", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }).catch(() => {});
      return { unlocked: true };
    }
    const res = await request("/api/auth/verify-pin/", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "PIN incorrect.");
    }
    return res.json();
  },

  async updateMe(payload: {
    first_name?: string;
    last_name?: string;
    telephone?: string;
    email?: string;
    specialite?: string;
    structure_principale?: number | null;
    structure_ids?: number[];
    type_exercice?: string;
    ville_exercice?: string;
    nom_etablissement?: string;
    numero_autorisation?: string;
    numero_ordre?: string;
    email_pro?: string;
    ligne_pro?: string;
    etablissement_libre?: { nom: string; ville?: string; type?: string };
  }): Promise<ProUser> {
    const user = normalizeUser(
      await requestJson<ProUser>("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    );
    await storage.saveUser(user);
    return user;
  },

  async uploadPhoto(uri: string, mime = "image/jpeg", filename = "identite.jpg"): Promise<ProUser> {
    const doUpload = async (): Promise<Response> => {
      const token = await storage.getAccess();
      if (!token) throw new Error(SESSION_EXPIRED_MSG);
      const form = new FormData();
      form.append("photo", { uri, type: mime, name: filename } as any);
      return fetch(`${API_URL}/api/auth/me/photo/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    };
    let res = await doUpload();
    if (res.status === 401 && (await tryRefresh())) {
      res = await doUpload();
    }
    if (res.status === 401) {
      await notifySessionExpired();
      throw new Error(SESSION_EXPIRED_MSG);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Upload photo impossible.");
    }
    const user = normalizeUser((await res.json()) as ProUser);
    await storage.saveUser(user);
    return user;
  },

  async hubDashboard() {
    const token = await storage.getAccess();
    if (!token) throw new Error(SESSION_EXPIRED_MSG);
    return requestJson("/api/hub/dashboard/");
  },

  async searchPatients(params: { npi?: string; nom?: string }) {
    const q = new URLSearchParams();
    if (params.npi) q.set("npi", params.npi);
    if (params.nom) q.set("nom", params.nom);
    const list = await requestJson(`/api/patients/search/?${q}`);
    const cache: PatientCacheItem[] = (list || []).map((p: any) => ({
      id: p.id,
      npi: p.npi,
      full_name: p.full_name,
      nom: p.nom,
      prenom: p.prenom,
      cachedAt: new Date().toISOString(),
    }));
    await storage.cachePatients(cache);
    return list;
  },

  async patientSuggestions(params?: { q?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.q) q.set("q", params.q);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return requestJson(`/api/patients/suggestions/${qs ? `?${qs}` : ""}`);
  },

  async patient(id: number | string) {
    try {
      const data = await requestJson(`/api/patients/${id}/`);
      await storage.cacheDossier(Number(id), data);
      return data;
    } catch (e) {
      const cached = await storage.getCachedDossier(Number(id));
      if (cached) {
        const navOffline =
          typeof navigator !== "undefined" &&
          typeof navigator.onLine === "boolean" &&
          !navigator.onLine;
        return { ...cached, _offline: navOffline, _fromCache: true };
      }
      throw e;
    }
  },

  async createPatient(body: Record<string, unknown>) {
    const res = await request("/api/patients/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatApiError(data, `Erreur API (${res.status})`));
    }
    return res.json();
  },

  async updatePatient(id: number | string, body: Record<string, unknown>) {
    const res = await request(`/api/patients/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatApiError(data, `Erreur API (${res.status})`));
    }
    return res.json();
  },

  async consultations(patientId: number) {
    try {
      const data = await requestJson(`/api/consultations/?patient=${patientId}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  async ordonnances(patientId: number) {
    try {
      const data = await requestJson(`/api/ordonnances/?patient=${patientId}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  /** Ordonnances actives d'un patient (dispensables dans toute pharmacie). */
  async ordonnancesActives(patientId: number) {
    try {
      const data = await requestJson(
        `/api/ordonnances/?statut=active&patient=${patientId}`
      );
      return data.results || data;
    } catch {
      return [];
    }
  },

  async examens(patientId: number) {
    try {
      const data = await requestJson(`/api/examens/?patient=${patientId}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  async examensList(params?: {
    patient?: number;
    categorie?: string;
    statut?: string;
    sans_fichier?: boolean;
    sans_resultat?: boolean;
  }) {
    try {
      const q = new URLSearchParams();
      if (params?.patient != null) q.set("patient", String(params.patient));
      if (params?.categorie) q.set("categorie", params.categorie);
      if (params?.statut) q.set("statut", params.statut);
      if (params?.sans_fichier) q.set("sans_fichier", "1");
      if (params?.sans_resultat) q.set("sans_resultat", "1");
      const qs = q.toString();
      const data = await requestJson(`/api/examens/${qs ? `?${qs}` : ""}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  async mesUploadsExamens() {
    try {
      const data = await requestJson("/api/examens/mes_uploads/");
      return data.results || data;
    } catch {
      return [];
    }
  },

  async examensACompleter() {
    try {
      const data = await requestJson("/api/examens/a_completer/");
      return data.results || data;
    } catch {
      return [];
    }
  },

  async createExamenMultipart(
    fields: Record<string, string>,
    file?: { uri: string; type?: string; name?: string } | null
  ) {
    const doUpload = async (): Promise<Response> => {
      const token = await storage.getAccess();
      if (!token) throw new Error(SESSION_EXPIRED_MSG);
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      if (file?.uri) {
        form.append("fichier", {
          uri: file.uri,
          type: file.type || "application/octet-stream",
          name: file.name || "examen.pdf",
        } as any);
      }
      return fetch(`${API_URL}/api/examens/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    };
    let res = await doUpload();
    if (res.status === 401 && (await tryRefresh())) {
      res = await doUpload();
    }
    if (res.status === 401) {
      await notifySessionExpired();
      throw new Error(SESSION_EXPIRED_MSG);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatApiError(data, "Upload examen impossible."));
    }
    return res.json();
  },

  async constantes(patientId: number) {
    try {
      const data = await requestJson(`/api/constantes/?patient=${patientId}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  async createConsultation(body: any) {
    return requestJson("/api/consultations/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async hospitals() {
    return requestJson("/api/auth/hospitals/");
  },

  async examCatalog() {
    return requestJson("/api/exam-catalog/");
  },

  async examOrders(params?: Record<string, string | number>) {
    const q = params
      ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return requestJson(`/api/exam-orders/${q}`);
  },

  async createExamOrder(body: any) {
    return requestJson("/api/exam-orders/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async demarrerConsultation(appointmentId: number) {
    return requestJson(`/api/appointments/${appointmentId}/demarrer-consultation/`, {
      method: "POST",
    });
  },

  async examOrderAction(id: number, action: "recevoir" | "demarrer" | "cloturer" | "deposer-resultat", body?: any) {
    return requestJson(`/api/exam-orders/${id}/${action}/`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async deposerResultat(
    id: number,
    fields: Record<string, string>,
    file?: { uri: string; type?: string; name?: string } | null
  ) {
    const doUpload = async (): Promise<Response> => {
      const token = await storage.getAccess();
      if (!token) throw new Error(SESSION_EXPIRED_MSG);
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => {
        if (v != null && v !== "") form.append(k, v);
      });
      if (file?.uri) {
        form.append("fichier", {
          uri: file.uri,
          type: file.type || "application/octet-stream",
          name: file.name || "resultat.pdf",
        } as any);
      }
      return fetch(`${API_URL}/api/exam-orders/${id}/deposer-resultat/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    };
    let res = await doUpload();
    if (res.status === 401 && (await tryRefresh())) {
      res = await doUpload();
    }
    if (res.status === 401) {
      await notifySessionExpired();
      throw new Error(SESSION_EXPIRED_MSG);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatApiError(data, "Dépôt du résultat impossible."));
    }
    return res.json();
  },

  async annulerConsultation(id: number) {
    return requestJson(`/api/consultations/${id}/annuler/`, { method: "POST" });
  },

  async createOrdonnance(body: any) {
    return requestJson("/api/ordonnances/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async dispenser(id: number) {
    return requestJson(`/api/ordonnances/${id}/dispenser/`, { method: "POST" });
  },

  async annulerOrdonnance(id: number) {
    return requestJson(`/api/ordonnances/${id}/annuler/`, { method: "POST" });
  },

  async annulerDispense(id: number) {
    return requestJson(`/api/ordonnances/${id}/annuler-dispense/`, { method: "POST" });
  },

  async createConstante(body: any) {
    return requestJson("/api/constantes/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async createExamen(body: any) {
    return requestJson("/api/examens/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async annulerExamen(id: number) {
    return requestJson(`/api/examens/${id}/annuler/`, { method: "POST" });
  },

  async appointments(params?: {
    statut?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
    structure?: number;
    patient?: number;
  }) {
    try {
      const q = new URLSearchParams();
      if (params?.statut) q.set("statut", params.statut);
      if (params?.date) q.set("date", params.date);
      if (params?.date_from) q.set("date_from", params.date_from);
      if (params?.date_to) q.set("date_to", params.date_to);
      if (params?.structure != null) q.set("structure", String(params.structure));
      if (params?.patient != null) q.set("patient", String(params.patient));
      const qs = q.toString();
      const data = await requestJson(`/api/appointments/${qs ? `?${qs}` : ""}`);
      return data.results || data;
    } catch {
      return [];
    }
  },

  /** RDV du jour (filtre client) - exclut les annulés. */
  async appointmentsToday() {
    const list = await this.appointments();
    const items = Array.isArray(list) ? list : [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return items
      .filter((a: any) => {
        if (!a?.debut || a.statut === "annule") return false;
        const dt = new Date(a.debut);
        return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
      })
      .sort(
        (a: any, b: any) => new Date(a.debut).getTime() - new Date(b.debut).getTime()
      );
  },

  async createAppointment(body: any) {
    return requestJson("/api/appointments/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async updateAppointment(id: number, body: Record<string, any>) {
    return requestJson(`/api/appointments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async listMedecinsRdv() {
    try {
      const data = await requestJson("/api/appointments/medecins/");
      return Array.isArray(data) ? data : data?.results || [];
    } catch {
      return [];
    }
  },

  async confirmerAppointment(id: number) {
    return requestJson(`/api/appointments/${id}/confirmer/`, { method: "POST" });
  },

  async updateAssurance(
    patientId: number,
    body: {
      assureur?: string;
      num_police?: string;
      droits_valides?: boolean;
      type_couverture?: string;
    }
  ) {
    return requestJson(`/api/patients/${patientId}/assurance/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async deleteAssurance(patientId: number) {
    return requestJson(`/api/patients/${patientId}/assurance/`, { method: "DELETE" });
  },

  async scanDotoCard(token: string, emergency = false) {
    return requestJson("/api/dodocards/scan/", {
      method: "POST",
      body: JSON.stringify({ token, emergency }),
    }) as Promise<{
      patient_id: number;
      npi: string;
      urgence: any;
      hub_notified?: boolean;
      consent_required?: boolean;
      emergency?: boolean;
      access_request?: any;
      message?: string;
    }>;
  },

  async requestAccess(patientId: number, emergency = false) {
    return requestJson("/api/access-requests/create/", {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        mode: "search",
        emergency,
      }),
    });
  },

  async accessRequest(id: number) {
    return requestJson(`/api/access-requests/${id}/`) as Promise<{
      id: number;
      patient_id: number;
      status: string;
      patient_name?: string;
      patient_npi?: string;
      has_active_grant?: boolean;
    }>;
  },

  async cancelAccessRequest(id: number) {
    return requestJson(`/api/access-requests/${id}/cancel/`, { method: "POST" });
  },

  async notifications() {
    try {
      const data = await requestJson("/api/notifications/");
      return data.results || data;
    } catch {
      return [];
    }
  },

  async unreadCount() {
    try {
      const data = await requestJson("/api/notifications/unread_count/");
      return data.unread ?? 0;
    } catch {
      return 0;
    }
  },

  async markNotifRead(id: number) {
    return requestJson(`/api/notifications/${id}/read/`, { method: "POST" });
  },

  async registerDeviceToken(token: string, platform: string, app = "dotohub") {
    return requestJson("/api/device-tokens/", {
      method: "POST",
      body: JSON.stringify({ token, platform, app }),
    }).catch(() => null);
  },

  eventsUrl(access: string) {
    return `${API_URL}/api/hub/events/?access=${encodeURIComponent(access)}`;
  },

  async logout() {
    try {
      await request("/api/auth/logout/", { method: "POST" });
    } catch {
      /* ignore */
    }
    await storage.clearSession();
  },
};
