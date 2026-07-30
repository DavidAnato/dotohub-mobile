import { create } from "zustand";
import { C, ProUser, darkC } from "../theme";
import { api } from "../api";
import { storage } from "../storage";

export type AppPhase = "boot" | "login" | "main";
export type Tab = "home" | "recherche" | "scan" | "parametres";

export type PendingConsent = {
  patientId: number;
  npi: string;
  name: string;
  accessRequestId?: number;
} | null;

export type AccessKick = {
  patientId: number;
  message: string;
} | null;

type AppState = {
  phase: AppPhase;
  tab: Tab;
  user: ProUser | null;
  patientId: number | null;
  pendingConsent: PendingConsent;
  accessKick: AccessKick;
  unread: number;
  online: boolean;
  dark: boolean;
  locked: boolean;
  needsPinSetup: boolean;
  setPhase: (p: AppPhase) => void;
  setTab: (t: Tab) => void;
  setUser: (u: ProUser | null) => void;
  setPatientId: (id: number | null) => void;
  setPendingConsent: (p: PendingConsent) => void;
  setAccessKick: (k: AccessKick) => void;
  clearAccessKick: () => void;
  setUnread: (n: number) => void;
  setOnline: (v: boolean) => void;
  setDark: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setNeedsPinSetup: (v: boolean) => void;
  toggleDark: () => Promise<void>;
  hydrateTheme: () => Promise<void>;
  enterMain: (u: ProUser) => void;
  /** Remet l'état mémoire à zéro (changement de compte / logout). */
  resetSessionState: () => void;
  colors: () => typeof C;
};

export const useAppStore = create<AppState>((set, get) => ({
  phase: "boot",
  tab: "home",
  user: null,
  patientId: null,
  pendingConsent: null,
  accessKick: null,
  unread: 0,
  online: true,
  dark: false,
  locked: false,
  needsPinSetup: false,

  setPhase: (phase) => set({ phase }),
  setTab: (tab) => set({ tab }),
  setUser: (user) => set({ user }),
  setPatientId: (patientId) => set({ patientId }),
  setPendingConsent: (pendingConsent) => set({ pendingConsent }),
  setAccessKick: (accessKick) => set({ accessKick }),
  clearAccessKick: () => set({ accessKick: null }),
  setUnread: (unread) => set({ unread }),
  setOnline: (online) => set({ online }),
  setDark: (dark) => set({ dark }),
  setLocked: (locked) => set({ locked }),
  setNeedsPinSetup: (needsPinSetup) => set({ needsPinSetup }),

  toggleDark: async () => {
    const next = !get().dark;
    set({ dark: next });
    await storage.setTheme(next ? "dark" : "light");
  },
  hydrateTheme: async () => {
    const t = await storage.getTheme();
    set({ dark: t === "dark" });
  },
  enterMain: (user) =>
    set({
      user,
      phase: "main",
      tab: "home",
      patientId: null,
      pendingConsent: null,
      accessKick: null,
      needsPinSetup: !user.pin_set,
      locked: !!user.pin_set,
    }),
  resetSessionState: () =>
    set({
      user: null,
      tab: "home",
      patientId: null,
      pendingConsent: null,
      accessKick: null,
      unread: 0,
      locked: false,
      needsPinSetup: false,
    }),
  colors: () => (get().dark ? darkC : C),
}));

function deviceLooksOnline(): boolean | null {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return null;
}

/** Online = réseau device OK. Un health ping raté ≠ hors ligne (API down ≠ offline). */
export async function pingOnline() {
  const nav = deviceLooksOnline();
  if (nav === false) {
    useAppStore.getState().setOnline(false);
    return;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${api.url}/api/health/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      useAppStore.getState().setOnline(true);
      return;
    }
    useAppStore.getState().setOnline(true);
  } catch {
    useAppStore.getState().setOnline(true);
  }
}
