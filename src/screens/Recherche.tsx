import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { C, darkC } from "../theme";
import { storage } from "../storage";
import { useSearchMutation } from "../queries/hooks";
import { Button, Field, Header } from "../ui";
import {
  BrandBackground,
  CardDecor,
  EmptyState,
  IconBadge,
  PressScale,
  ScreenEnter,
  SkeletonList,
  StaggerItem,
} from "../motion";
import { Avatar } from "../components/Avatar";
import { usePullRefresh } from "../hooks/usePullRefresh";

export default function Recherche({
  dark,
  onOpenPatient,
}: {
  dark?: boolean;
  onOpenPatient: (id: number) => void;
}) {
  const colors = dark ? darkC : C;
  const [npi, setNpi] = useState("");
  const [nom, setNom] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [offlineHint, setOfflineHint] = useState(false);
  const [booting, setBooting] = useState(true);
  const searchMut = useSearchMutation();
  const busy = searchMut.isPending;

  useEffect(() => {
    storage.getCachedPatients().then((list) => {
      if (list.length) {
        setResults(list);
        setOfflineHint(true);
      }
      setBooting(false);
    });
  }, []);

  const search = async () => {
    if (!npi.trim() && !nom.trim()) {
      setError("Saisissez un NPI ou un nom.");
      return;
    }
    setError("");
    setOfflineHint(false);
    try {
      const list = await searchMut.mutateAsync({
        npi: npi.trim() || undefined,
        nom: nom.trim() || undefined,
      });
      setResults(list);
      if (!list.length) setError("Aucun patient trouvé.");
    } catch (e: any) {
      const cache = await storage.getCachedPatients();
      setResults(cache);
      setOfflineHint(true);
      setError(e.message || "Recherche hors ligne — cache local.");
    }
  };

  const { refreshControl } = usePullRefresh({
    refetch: [
      async () => {
        if (npi.trim() || nom.trim()) {
          await search();
          return;
        }
        const cache = await storage.getCachedPatients();
        if (cache.length) {
          setResults(cache);
          setOfflineHint(true);
        }
      },
    ],
    progressBackgroundColor: colors.white,
  });

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header title="Recherche patient" subtitle="NPI ou nom" />
        <View style={{ padding: 16 }}>
          <Field
            label="NPI"
            value={npi}
            onChangeText={(t) => setNpi(t.replace(/\D/g, "").slice(0, 10))}
            placeholder="1234567890"
            keyboardType="number-pad"
            maxLength={10}
            colors={colors}
          />
          <Field
            label="Nom / prénom"
            value={nom}
            onChangeText={setNom}
            placeholder="Adjovi"
            colors={colors}
          />
          {error ? (
            <Text style={{ color: colors.amber, marginBottom: 8, fontWeight: "700" }}>{error}</Text>
          ) : null}
          {offlineHint ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
              Affichage du cache local (hors ligne ou dernier résultat).
            </Text>
          ) : null}
          <Button title="Rechercher" icon="search-outline" onPress={search} loading={busy} color={C.teal} />
        </View>

        {booting && results.length === 0 ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={4} dark={!!dark} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
            refreshControl={refreshControl}
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title="Aucun résultat"
                subtitle="Lancez une recherche par NPI ou nom."
                dark={!!dark}
              />
            }
            renderItem={({ item, index }) => (
              <StaggerItem index={index}>
                <PressScale
                  onPress={() => onOpenPatient(item.id)}
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    shadowColor: "#1E3755",
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                    overflow: "hidden",
                    minHeight: 64,
                  }}
                >
                  <CardDecor variant="calm" dark={!!dark} />
                  <Avatar
                    uri={item.photo_url}
                    name={item.full_name || `${item.prenom || ""} ${item.nom || ""}`.trim()}
                    size={40}
                    bg={C.blue}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {item.full_name || `${item.prenom || ""} ${item.nom || ""}`.trim()}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.npi}</Text>
                  </View>
                  <IconBadge name="chevron-forward" color={colors.grey} size={28} />
                </PressScale>
              </StaggerItem>
            )}
          />
        )}
      </ScreenEnter>
    </BrandBackground>
  );
}
