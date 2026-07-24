import React, { useCallback, useRef, useState } from "react";
import { RefreshControl } from "react-native";
import { QueryKey, useQueryClient } from "@tanstack/react-query";
import { brandBlue } from "../theme";
import { pingOnline } from "../store/appStore";
import { hapticLight } from "../motion";

export type UsePullRefreshOptions = {
  /** Clés TanStack Query à invalider (refetch des queries actives). */
  keys?: readonly QueryKey[];
  /** Chargeurs locaux / sync Zustand complémentaires. */
  refetch?: Array<() => unknown | Promise<unknown>>;
  /** Ping health + mise à jour `online` Zustand (défaut true). */
  ping?: boolean;
  tintColor?: string;
  /** Fond du spinner Android (défaut surface claire). */
  progressBackgroundColor?: string;
  /** Haptic léger au déclenchement (défaut true). */
  haptic?: boolean;
};

/**
 * Pull-to-refresh offline-first : les données en cache restent affichées ;
 * le geste force invalidate/refetch + ping réseau.
 */
export function usePullRefresh(options: UsePullRefreshOptions = {}) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  const onRefresh = useCallback(async () => {
    const {
      keys = [],
      refetch = [],
      ping = true,
      haptic = true,
    } = optsRef.current;
    setRefreshing(true);
    if (haptic) {
      void hapticLight();
    }
    try {
      if (ping) {
        await pingOnline();
      }
      await Promise.all([
        ...keys.map((queryKey) => qc.invalidateQueries({ queryKey })),
        ...refetch.map((fn) =>
          Promise.resolve()
            .then(fn)
            .catch(() => undefined)
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const tint = options.tintColor ?? brandBlue;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        void onRefresh();
      }}
      tintColor={tint}
      colors={[tint]}
      progressBackgroundColor={options.progressBackgroundColor ?? "#FFFFFF"}
    />
  );

  return { refreshing, onRefresh, refreshControl };
}
