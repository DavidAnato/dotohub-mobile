import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, darkC } from "../theme";
import { api } from "../api";
import { Button } from "../ui";
import { appAlert } from "./AppDialog";

export function HospitalAttachGate({
  visible,
  dark,
  onDone,
}: {
  visible: boolean;
  dark: boolean;
  onDone: (user: any) => void;
}) {
  const colors = dark ? darkC : C;
  const [hospitals, setHospitals] = useState<{ id: number; nom: string }[]>([]);
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [principalId, setPrincipalId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    api
      .hospitals()
      .then((r: any) => setHospitals(r.structures || []))
      .catch(() => setHospitals([]));
  }, [visible]);

  const save = async () => {
    if (!pickedIds.length) {
      appAlert("Hôpitaux", "Choisissez au moins un hôpital.");
      return;
    }
    if (!principalId) {
      appAlert("Hôpitaux", "Désignez l'hôpital principal.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.updateMe({
        structure_ids: pickedIds,
        structure_principale: principalId || null,
      });
      onDone(updated);
    } catch (e: any) {
      appAlert("Erreur", e.message || "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: dark ? "#0A0A0A" : "#F0F4F7", paddingTop: 48 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20, paddingHorizontal: 20 }}>
          Vos hôpitaux
        </Text>
        <Text style={{ color: colors.muted, paddingHorizontal: 20, marginTop: 6, marginBottom: 12 }}>
          Choisissez les structures où vous exercez et désignez le principal.
        </Text>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 8 }}>
          {hospitals.map((h) => {
            const on = pickedIds.includes(h.id);
            return (
              <Pressable
                key={h.id}
                onPress={() => {
                  const next = on ? pickedIds.filter((x) => x !== h.id) : [...pickedIds, h.id];
                  setPickedIds(next);
                  if (principalId && !next.includes(Number(principalId))) {
                    setPrincipalId(next[0] || "");
                  } else if (!principalId && next.length === 1) {
                    setPrincipalId(next[0]);
                  }
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}
              >
                <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? C.teal : colors.muted} />
                <Text style={{ color: colors.text, flex: 1 }}>{h.nom}</Text>
                {on ? (
                  <Pressable onPress={() => setPrincipalId(h.id)}>
                    <Text style={{ color: principalId === h.id ? C.teal : colors.muted, fontSize: 11, fontWeight: "700" }}>
                      {principalId === h.id ? "Principal" : "Principal ?"}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
          <Button title="Valider" loading={busy} color={C.teal} onPress={() => void save()} />
        </ScrollView>
      </View>
    </Modal>
  );
}
