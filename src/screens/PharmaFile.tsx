import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { appAlert } from "../components/AppDialog";
import PatientSelectSearch, {
  type PatientOption,
} from "../components/PatientSelectSearch";
import { api } from "../api";
import { usePullRefresh } from "../hooks/usePullRefresh";
import {
  BrandBackground,
  EmptyState,
  ScreenEnter,
  SkeletonList,
  StaggerItem,
  hapticSuccess,
} from "../motion";
import { Button, Card, Header } from "../ui";
import { C, darkC } from "../theme";

function medsResume(meds: any[] | undefined): string {
  if (!meds?.length) return "Aucun médicament";
  const names = meds.map((m) => m.nom).filter(Boolean);
  if (!names.length) return "Aucun médicament";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} (+${names.length - 3})`;
}

export default function PharmaFile({
  dark = false,
  onBack,
}: {
  dark?: boolean;
  onBack: () => void;
}) {
  const colors = dark ? darkC : C;
  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!patientId) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const list = await api.ordonnances(Number(patientId));
        const arr = Array.isArray(list) ? list : [];
        setItems(arr.filter((o: any) => o.statut === "active" || o.statut === "dispensee" || o.statut === "payee"));
      } catch (e: any) {
        appAlert("Erreur", e.message || "Ordonnances indisponibles");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [patientId]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { refreshControl } = usePullRefresh({
    refetch: [() => (patientId ? load({ silent: true }) : Promise.resolve())],
    progressBackgroundColor: colors.white,
  });

  const onPatientChange = (id: string, p?: PatientOption | null) => {
    setPatientId(id);
    setPatientLabel(
      p
        ? p.full_name || `${p.prenom || ""} ${p.nom || ""}`.trim() || `Patient #${id}`
        : id
          ? `Patient #${id}`
          : ""
    );
  };

  const dispense = (id: number) => {
    appAlert("Paiement", "Marquer cette ordonnance comme payée ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        onPress: async () => {
          setBusyId(id);
          try {
            await api.dispenser(id);
            hapticSuccess();
            await load({ silent: true });
          } catch (e: any) {
            appAlert("Erreur", e.message || "Dispense impossible");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const undoDispense = (id: number) => {
    appAlert("Annuler le paiement", "L'ordonnance redeviendra active. Continuer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        onPress: async () => {
          setBusyId(id);
          try {
            await api.annulerDispense(id);
            hapticSuccess();
            await load({ silent: true });
          } catch (e: any) {
            appAlert("Erreur", e.message || "Annulation impossible");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title="File pharmacie"
          subtitle="Ordonnance valable dans toute pharmacie"
          onBack={onBack}
        />
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
            Patient au comptoir
          </Text>
          <PatientSelectSearch
            value={patientId}
            onChange={onPatientChange}
            dark={!!dark}
            placeholder="NPI ou nom du patient…"
          />
        </View>

        {!patientId ? (
          <View style={{ padding: 16, flex: 1 }}>
            <EmptyState
              icon="medkit-outline"
              title="Identifier le patient"
              subtitle="L’ordonnance est prescrite par le médecin - le patient peut l’acheter dans n’importe quelle pharmacie. Recherchez-le pour voir ses ordonnances actives."
              dark={!!dark}
            />
          </View>
        ) : loading && items.length === 0 ? (
          <View style={{ padding: 16 }}>
            <SkeletonList count={4} dark={!!dark} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12, flexGrow: 1 }}
            refreshControl={refreshControl}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
              ) : (
                <EmptyState
                  icon="medkit-outline"
                  title="Aucune ordonnance"
                  subtitle={`Pas d’ordonnance active ou dispensée pour ${patientLabel || "ce patient"}.`}
                  dark={!!dark}
                />
              )
            }
            renderItem={({ item, index }) => (
              <StaggerItem index={index}>
                <Card colors={colors} decor="teal" style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                        {item.patient_nom || patientLabel || `Patient #${item.patient}`}
                      </Text>
                      {item.patient_npi ? (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          NPI {item.patient_npi}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: item.statut === "dispensee" || item.statut === "payee" ? C.emerald : C.teal,
                        fontSize: 11,
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.statut_label || item.statut || "active"}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {item.date ? new Date(item.date).toLocaleDateString("fr-FR") : "-"}
                    {item.medecin_nom ? ` · Dr ${item.medecin_nom}` : ""}
                    {item.structure_nom ? ` · prescrit à ${item.structure_nom}` : ""}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {medsResume(item.medicaments)}
                  </Text>
                  {item.alertes_interactions?.length > 0 ? (
                    <Text style={{ color: colors.amber, fontSize: 12, fontWeight: "600" }}>
                      {item.alertes_interactions.join(" ")}
                    </Text>
                  ) : null}
                  {item.statut === "active" ? (
                    <Button
                      title="Marquer payée"
                      icon="checkmark-circle-outline"
                      color={C.emerald}
                      compact
                      loading={busyId === item.id}
                      disabled={busyId != null}
                      onPress={() => dispense(item.id)}
                    />
                  ) : null}
                  {item.statut === "dispensee" || item.statut === "payee" ? (
                    <Button
                      title="Annuler le paiement"
                      icon="arrow-undo-outline"
                      color={colors.muted}
                      compact
                      loading={busyId === item.id}
                      disabled={busyId != null}
                      onPress={() => undoDispense(item.id)}
                    />
                  ) : null}
                </Card>
              </StaggerItem>
            )}
          />
        )}
      </ScreenEnter>
    </BrandBackground>
  );
}
