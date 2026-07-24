/**
 * Fin de session client : stockage + React Query + Zustand.
 * À appeler après logout ou expiration JWT pour éviter le mélange entre comptes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { queryClient } from "./queries/queryClient";
import { useAppStore } from "./store/appStore";

const RQ_PERSIST_KEY = "dotohub-mobile-react-query";

export async function wipeClientCaches() {
  queryClient.clear();
  try {
    await AsyncStorage.removeItem(RQ_PERSIST_KEY);
  } catch {
    /* ignore */
  }
  useAppStore.getState().resetSessionState();
}

export async function logoutFully() {
  await api.logout();
  await wipeClientCaches();
}
