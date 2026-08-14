/**
 * File d'actions hors-ligne (FIFO) + replay à la reconnexion.
 * Conflit : last-write / timestamp — HTTP 409 écarte l'action locale.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineAction = {
  id: string;
  method: "POST" | "PATCH" | "PUT";
  path: string;
  body?: unknown;
  createdAt: string;
  clientUpdatedAt?: string;
};

const KEY = "hub_offline_queue";

async function load(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function save(list: OfflineAction[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 80)));
}

export async function enqueueOffline(action: Omit<OfflineAction, "id" | "createdAt">) {
  const list = await load();
  list.push({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  await save(list);
  return list.length;
}

export async function replayOfflineQueue(
  send: (a: OfflineAction) => Promise<{ ok: boolean; status?: number }>
) {
  const list = await load();
  const remaining: OfflineAction[] = [];
  for (const a of list) {
    try {
      const res = await send(a);
      if (!res.ok && res.status !== 409) remaining.push(a);
    } catch {
      remaining.push(a);
    }
  }
  await save(remaining);
  return { replayed: list.length - remaining.length, remaining: remaining.length };
}
