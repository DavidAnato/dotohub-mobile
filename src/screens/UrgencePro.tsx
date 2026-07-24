import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { appAlert } from "../components/AppDialog";
import { api } from "../api";
import { Button, Header } from "../ui";
import { C, darkC, onBrand } from "../theme";
import { BrandBackground, EmptyState, ScreenEnter } from "../motion";

const EM = {
  bg: "#0B0606",
  surface: "#1A1010",
  border: "#3F1A1A",
  text: "#F5F5F5",
  muted: "#A8A29E",
  red: C.emergency,
  redSoft: "#450A0A",
  redBorder: "#A32D2D66",
};

function displayVal(v?: string | null) {
  const t = (v || "").trim();
  return t || "Non identifié";
}

function listVal(list?: string[] | null) {
  if (!list || !list.length) return "Non identifié";
  return list.join(" · ");
}

function VitalRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        s.vitalRow,
        !last && { borderBottomWidth: 1, borderBottomColor: EM.border },
      ]}
    >
      <View style={s.vitalIcon}>
        <Ionicons name={icon} size={18} color={EM.red} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.vitalLabel}>{label}</Text>
        <Text style={s.vitalValue} numberOfLines={3}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function UrgencePro({
  patientId,
  dark = true,
  onBack,
  initialUrgence,
}: {
  patientId?: number;
  dark?: boolean;
  onBack: () => void;
  /** Données urgence déjà reçues au scan (évite flash vide). */
  initialUrgence?: any;
}) {
  const colors = dark ? darkC : C;
  const [urgence, setUrgence] = useState<any>(initialUrgence || null);
  const [loading, setLoading] = useState(!!patientId && !initialUrgence);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [temp, setTemp] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const load = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.patient(patientId);
      setUrgence(data?.urgence || data || null);
    } catch (e: any) {
      if (!initialUrgence) {
        appAlert("Erreur", e?.message || "Impossible de charger l'urgence.");
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, initialUrgence]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const callEmergency = () => {
    const tel = (urgence?.tel_urgence || "").replace(/\s+/g, "");
    if (!tel) {
      appAlert("Contact", "Aucun numéro d'urgence enregistré.");
      return;
    }
    Linking.openURL(`tel:${tel}`).catch(() =>
      appAlert("Appel", "Impossible d'ouvrir le composeur téléphonique.")
    );
  };

  const saveConstantes = async () => {
    if (!patientId) return;
    const sysN = Number(sys);
    const diaN = Number(dia);
    if (!sys.trim() || !dia.trim() || Number.isNaN(sysN) || Number.isNaN(diaN)) {
      appAlert("Constantes", "Indiquez la tension (systolique / diastolique).");
      return;
    }
    setBusy(true);
    setSavedMsg("");
    try {
      const body: Record<string, any> = {
        patient: patientId,
        tension_systolique: sysN,
        tension_diastolique: diaN,
      };
      if (temp.trim()) {
        const t = Number(temp.replace(",", "."));
        if (!Number.isNaN(t)) body.temperature = t;
      }
      await api.createConstante(body);
      setSavedMsg("Constantes enregistrées");
      setSys("");
      setDia("");
      setTemp("");
    } catch (e: any) {
      appAlert("Erreur", e?.message || "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!patientId) {
    return (
      <BrandBackground dark>
        <ScreenEnter>
          <Header title="Urgence" subtitle="Prise en charge rapide" onBack={onBack} />
          <View style={{ padding: 16, flex: 1 }}>
            <EmptyState
              icon="alert-circle-outline"
              title="Mode urgence"
              subtitle="Scannez une DodoCard pour démarrer"
              dark
            />
          </View>
        </ScreenEnter>
      </BrandBackground>
    );
  }

  const name =
    urgence?.full_name ||
    (urgence?.nom
      ? `${urgence.prenom || ""} ${urgence.nom || ""}`.trim()
      : "Patient");
  const npi = urgence?.npi || "";
  const contactName = urgence?.contact_urgence_nom
    ? `${urgence.contact_urgence_nom}${
        urgence.contact_urgence_lien ? ` (${urgence.contact_urgence_lien})` : ""
      }`
    : "—";
  const tel = (urgence?.tel_urgence || "").trim();

  return (
    <BrandBackground dark>
      <ScreenEnter>
        <Header
          title="Urgence"
          subtitle={npi ? `${name} · ${npi}` : name}
          onBack={onBack}
        />
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Bannière journalisation */}
          <View style={s.banner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={EM.red} />
            <Text style={s.bannerText}>Accès urgence journalisé</Text>
          </View>

          {loading && !urgence ? (
            <View style={s.center}>
              <ActivityIndicator color={EM.red} />
              <Text style={{ color: EM.muted, marginTop: 10, fontWeight: "600" }}>
                Chargement…
              </Text>
            </View>
          ) : !urgence ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Données indisponibles"
              subtitle="Rescannez la DodoCard en mode urgence"
              dark
            />
          ) : (
            <>
              <View style={s.panel}>
                <View style={s.panelAccent} />
                <View style={s.panelBody}>
                  <Text style={s.panelTitle}>INFOS CRITIQUES</Text>
                  <VitalRow
                    icon="water"
                    label="Groupe sanguin"
                    value={displayVal(urgence.groupe_sanguin)}
                  />
                  <VitalRow
                    icon="flask"
                    label="Électrophorèse"
                    value={displayVal(urgence.electrophorese)}
                  />
                  <VitalRow
                    icon="warning-outline"
                    label="Allergies"
                    value={listVal(urgence.allergies)}
                  />
                  <VitalRow
                    icon="fitness-outline"
                    label="Maladies chroniques"
                    value={listVal(urgence.maladies_chroniques)}
                    last
                  />
                </View>
              </View>

              <Pressable
                onPress={callEmergency}
                style={({ pressed }) => [
                  s.contactCard,
                  pressed && { opacity: 0.88 },
                  !tel && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  tel ? `Appeler le contact d'urgence ${tel}` : "Contact d'urgence indisponible"
                }
              >
                <View style={s.contactIcon}>
                  <Ionicons name="call" size={22} color={onBrand} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.contactLabel}>Contact d'urgence</Text>
                  <Text style={s.contactName} numberOfLines={1}>
                    {contactName}
                  </Text>
                  <Text style={s.contactTel}>{tel || "Aucun numéro"}</Text>
                </View>
                {tel ? (
                  <Ionicons name="chevron-forward" size={20} color={EM.muted} />
                ) : null}
              </Pressable>

              <View style={s.panel}>
                <View style={[s.panelAccent, { backgroundColor: C.blue }]} />
                <View style={s.panelBody}>
                  <Text style={s.panelTitle}>CONSTANTES RAPIDES</Text>
                  <View style={s.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>TA syst.</Text>
                      <TextInput
                        value={sys}
                        onChangeText={setSys}
                        placeholder="120"
                        placeholderTextColor={EM.muted}
                        keyboardType="number-pad"
                        style={s.input}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inputLabel}>TA diast.</Text>
                      <TextInput
                        value={dia}
                        onChangeText={setDia}
                        placeholder="80"
                        placeholderTextColor={EM.muted}
                        keyboardType="number-pad"
                        style={s.input}
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.inputLabel}>Température (°C)</Text>
                    <TextInput
                      value={temp}
                      onChangeText={setTemp}
                      placeholder="37.0"
                      placeholderTextColor={EM.muted}
                      keyboardType="decimal-pad"
                      style={s.input}
                    />
                  </View>
                  {savedMsg ? (
                    <Text style={s.saved}>{savedMsg}</Text>
                  ) : null}
                  <View style={{ marginTop: 14 }}>
                    <Button
                      title="Enregistrer"
                      icon="save-outline"
                      color={EM.red}
                      loading={busy}
                      onPress={saveConstantes}
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          <Text style={[s.footerNote, { color: colors.muted }]}>
            Écran dédié ambulancier — pas de dossier complet
          </Text>
        </ScrollView>
      </ScreenEnter>
    </BrandBackground>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 36 },
  center: { alignItems: "center", paddingVertical: 40 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: EM.redSoft,
    borderWidth: 1,
    borderColor: EM.redBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerText: {
    color: EM.red,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.2,
    flex: 1,
  },
  panel: {
    backgroundColor: EM.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: EM.border,
    overflow: "hidden",
  },
  panelAccent: { height: 3, backgroundColor: EM.red },
  panelBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  panelTitle: {
    color: EM.red,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
  },
  vitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  vitalIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: EM.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  vitalLabel: {
    color: EM.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  vitalValue: {
    color: EM.text,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 2,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: EM.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: EM.redBorder,
    padding: 14,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: EM.red,
    alignItems: "center",
    justifyContent: "center",
  },
  contactLabel: {
    color: EM.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  contactName: {
    color: EM.text,
    fontWeight: "800",
    fontSize: 16,
    marginTop: 2,
  },
  contactTel: {
    color: EM.red,
    fontWeight: "700",
    fontSize: 14,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  formRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  inputLabel: {
    color: EM.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: EM.bg,
    borderWidth: 1.5,
    borderColor: EM.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: EM.text,
    fontSize: 16,
    fontWeight: "700",
  },
  saved: {
    color: C.teal,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 10,
  },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
