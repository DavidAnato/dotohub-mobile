import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, darkC, accent } from "../theme";
import { api } from "../api";
import { AuthScreenHeader, Button, Field, PhoneField } from "../ui";
import { appAlert } from "./AppDialog";
import { useScreenInsets } from "../safeArea";
import { TYPE_EXERCICE } from "../constants";

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
  const { scrollBottom } = useScreenInsets();
  const [hospitals, setHospitals] = useState<{ id: number; nom: string; commune?: string }[]>([]);
  const [kind, setKind] = useState("etablissement_sante");
  const [ville, setVille] = useState("");
  const [nomLibre, setNomLibre] = useState("");
  const [autorisation, setAutorisation] = useState("");
  const [ordre, setOrdre] = useState("");
  const [emailPro, setEmailPro] = useState("");
  const [lignePro, setLignePro] = useState("");
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

  const independant = kind === "independant";

  const save = async () => {
    if (!independant && !pickedIds.length && !nomLibre.trim()) {
      appAlert("Inscription", "Choisissez un établissement du catalogue ou saisissez un nom.");
      return;
    }
    if (independant && !nomLibre.trim()) {
      appAlert("Inscription", "Indiquez le nom de votre cabinet / exercice.");
      return;
    }
    if (!independant && pickedIds.length && !principalId) {
      appAlert("Inscription", "Désignez l'établissement principal.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        type_exercice: kind,
        ville_exercice: ville,
        nom_etablissement: nomLibre,
        numero_autorisation: autorisation,
        numero_ordre: ordre,
        email_pro: emailPro,
        ligne_pro: lignePro,
        structure_ids: pickedIds,
        structure_principale: principalId || null,
      };
      if (nomLibre.trim()) {
        payload.etablissement_libre = { nom: nomLibre.trim(), ville, type: kind };
      }
      const updated = await api.updateMe(payload);
      onDone(updated);
    } catch (e: any) {
      appAlert("Erreur", e.message || "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: dark ? "#0A0A0A" : "#F4FBFC" }}>
        <AuthScreenHeader
          colors={colors}
          title="Votre exercice"
          subtitle="Type, établissement et autorisations."
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: scrollBottom, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, marginBottom: 8 }}>
            Type d'exercice
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {TYPE_EXERCICE.map((k) => (
              <Pressable
                key={k.v}
                onPress={() => setKind(k.v)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: kind === k.v ? "rgba(43,179,188,0.12)" : "transparent",
                  borderWidth: 1,
                  borderColor: kind === k.v ? accent : colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
                  {k.l}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field label="Ville d'exercice" value={ville} onChangeText={setVille} colors={colors} placeholder="Cotonou" />
          <Field
            label={independant ? "Nom du cabinet / exercice" : "Nom établissement (si hors catalogue)"}
            value={nomLibre}
            onChangeText={setNomLibre}
            colors={colors}
            placeholder="Clinique, pharmacie ou cabinet"
          />
          <Field label="N° autorisation" value={autorisation} onChangeText={setAutorisation} colors={colors} />
          <Field label="N° Ordre National" value={ordre} onChangeText={setOrdre} colors={colors} />
          <Field label="Email professionnel" value={emailPro} onChangeText={setEmailPro} colors={colors} keyboardType="email-address" />
          <PhoneField label="Ligne professionnelle +229" value={lignePro} onChangeText={setLignePro} colors={colors} />

          {!independant ? (
            <>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12, marginTop: 8 }}>
                ÉTABLISSEMENTS DU CATALOGUE
              </Text>
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
                    <Text style={{ color: colors.text, flex: 1 }}>
                      {h.nom}
                      {h.commune ? ` · ${h.commune}` : ""}
                    </Text>
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
            </>
          ) : null}
          <Button title="Valider" loading={busy} color={dark ? accent : C.navy} onPress={() => void save()} />
        </ScrollView>
      </View>
    </Modal>
  );
}
