import React, { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { appAlert } from "../components/AppDialog";
import { Avatar } from "../components/Avatar";
import { usePullRefresh } from "../hooks/usePullRefresh";
import {
  BrandBackground,
  EmptyState,
  ScreenEnter,
  StaggerItem,
} from "../motion";
import { api } from "../api";
import { Button, Card, Header } from "../ui";
import { C, darkC } from "../theme";

function formatHeure(debut?: string) {
  if (!debut) return "—";
  return new Date(debut).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statutColor(statut: string) {
  if (statut === "termine") return C.muted;
  if (statut === "confirme") return C.teal;
  if (statut === "absent") return C.amber;
  return C.navy;
}

export default function Tournee({
  dark = false,
  onBack,
  onOpenPatient,
}: {
  dark?: boolean;
  onBack: () => void;
  onOpenPatient?: (id: number) => void;
}) {
  const colors = dark ? darkC : C;
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const openPatient = (id: number) => {
    if (onOpenPatient) {
      onOpenPatient(id);
      return;
    }
    navigation.navigate("Patient", { patientId: id });
  };

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await api.appointmentsToday();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      appAlert("Erreur", e.message || "Tournée indisponible");
      setItems([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { refreshControl } = usePullRefresh({
    refetch: [() => load({ silent: true })],
    progressBackgroundColor: colors.white,
  });

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title="Tournée du jour"
          subtitle={`${todayLabel} — constantes sur le dossier`}
          onBack={onBack}
        />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={refreshControl}
        >
          {loading ? (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>
              Chargement…
            </Text>
          ) : null}

          {!loading && items.length === 0 ? (
            <EmptyState
              icon="walk-outline"
              title="Aucun patient prévu aujourd’hui"
              subtitle="Les rendez-vous du jour (hors annulés) apparaîtront ici."
              dark={!!dark}
            />
          ) : null}

          {items.map((a, i) => (
            <StaggerItem key={a.id} index={i}>
              <Card colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <Avatar
                    uri={a.patient_photo_url}
                    name={a.patient_name || `Patient #${a.patient}`}
                    size={40}
                    bg={C.navy}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "800",
                        fontSize: 18,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatHeure(a.debut)}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, marginTop: 2 }}>
                      {a.patient_name || `Patient #${a.patient}`}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                      {a.motif || "Sans motif"}
                    </Text>
                    <Text
                      style={{
                        color: statutColor(a.statut),
                        fontWeight: "800",
                        marginTop: 8,
                        fontSize: 12,
                      }}
                    >
                      {a.statut_label || a.statut}
                    </Text>
                  </View>
                </View>
                {a.patient ? (
                  <View style={{ marginTop: 12 }}>
                    <Button
                      title="Ouvrir dossier"
                      icon="folder-open-outline"
                      color={C.teal}
                      onPress={() => openPatient(Number(a.patient))}
                    />
                  </View>
                ) : null}
              </Card>
            </StaggerItem>
          ))}
        </ScrollView>
      </ScreenEnter>
    </BrandBackground>
  );
}
