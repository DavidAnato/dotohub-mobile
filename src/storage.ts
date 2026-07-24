import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { ProUser } from "./theme";

const KEYS = {
  access: "hub_access",
  refresh: "hub_refresh",
  user: "hub_user",
  theme: "hub_theme",
  patientsCache: "hub_patients_cache",
  dossierCache: "hub_dossier_cache",
  bioEnabled: "hub_bio_enabled",
};

export type PatientCacheItem = {
  id: number;
  npi: string;
  full_name: string;
  nom?: string;
  prenom?: string;
  cachedAt: string;
};

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string) {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureDel(key: string) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const storage = {
  async saveTokens(access: string, refresh: string) {
    await secureSet(KEYS.access, access);
    await secureSet(KEYS.refresh, refresh);
  },
  async getAccess() {
    return (await secureGet(KEYS.access)) || null;
  },
  async getRefresh() {
    return (await secureGet(KEYS.refresh)) || null;
  },
  async clearTokens() {
    await secureDel(KEYS.access);
    await secureDel(KEYS.refresh);
  },

  async saveUser(user: ProUser) {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  },
  async getUser(): Promise<ProUser | null> {
    const raw = await AsyncStorage.getItem(KEYS.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async setTheme(theme: "light" | "dark") {
    await AsyncStorage.setItem(KEYS.theme, theme);
  },
  async getTheme(): Promise<"light" | "dark"> {
    const t = await AsyncStorage.getItem(KEYS.theme);
    return t === "dark" ? "dark" : "light";
  },

  async setBioEnabled(v: boolean) {
    await secureSet(KEYS.bioEnabled, v ? "1" : "0");
  },
  async isBioEnabled() {
    return (await secureGet(KEYS.bioEnabled)) === "1";
  },

  async cachePatients(list: PatientCacheItem[]) {
    await AsyncStorage.setItem(KEYS.patientsCache, JSON.stringify(list.slice(0, 20)));
  },
  async getCachedPatients(): Promise<PatientCacheItem[]> {
    const raw = await AsyncStorage.getItem(KEYS.patientsCache);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async cacheDossier(patientId: number, data: object) {
    const raw = await AsyncStorage.getItem(KEYS.dossierCache);
    let map: Record<string, object> = {};
    try {
      map = raw ? JSON.parse(raw) : {};
    } catch {
      map = {};
    }
    map[String(patientId)] = { ...data, _cachedAt: new Date().toISOString() };
    const keys = Object.keys(map);
    if (keys.length > 15) {
      for (const k of keys.slice(0, keys.length - 15)) delete map[k];
    }
    await AsyncStorage.setItem(KEYS.dossierCache, JSON.stringify(map));
  },
  async getCachedDossier(patientId: number): Promise<any | null> {
    const raw = await AsyncStorage.getItem(KEYS.dossierCache);
    if (!raw) return null;
    try {
      return JSON.parse(raw)[String(patientId)] || null;
    } catch {
      return null;
    }
  },

  async clearSession() {
    await this.clearTokens();
    await secureDel(KEYS.bioEnabled);
    await AsyncStorage.multiRemove([KEYS.user, KEYS.patientsCache, KEYS.dossierCache]);
  },
};
