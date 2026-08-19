import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { appAlert } from "../components/AppDialog";
import PatientSelectSearch from "../components/PatientSelectSearch";
import {
  BrandBackground,
  EmptyState,
  IconBadge,
  PressScale,
  ScreenEnter,
  SkeletonList,
  StaggerItem,
} from "../motion";
import { Button, Card, Field, Header } from "../ui";
import { C, darkC } from "../theme";
import { api } from "../api";
import { usePullRefresh } from "../hooks/usePullRefresh";

type Scope = "tous" | "mes" | "incomplets";

type ExamenItem = {
  id: number;
  patient?: number;
  patient_nom?: string;
  patient_npi?: string;
  type_examen?: string;
  categorie?: string;
  categorie_label?: string;
  date?: string;
  statut?: string;
  statut_label?: string;
  resultat_texte?: string;
  fichier_url?: string | null;
  laboratoire?: string;
  annule?: boolean;
};

const STATUT_META: Record<string, { label: string; color: string; soft: string }> = {
  normal: { label: "Normal", color: "#166534", soft: "#DCFCE7" },
  eleve: { label: "Élevé", color: C.amber, soft: C.amberSoft },
  critique: { label: "Critique", color: C.emergency, soft: C.emergencySoft },
};

const EMPTY_FORM = {
  patient: "",
  type_examen: "",
  categorie: "analyses" as "analyses" | "imagerie" | "autres",
  date: new Date().toISOString().slice(0, 10),
  statut: "normal" as "normal" | "eleve" | "critique",
  resultat_texte: "",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function StatusPill({ statut, dark }: { statut?: string; dark: boolean }) {
  const key = statut || "normal";
  const meta = STATUT_META[key] || STATUT_META.normal;
  return (
    <View
      style={{
        backgroundColor: dark ? meta.color + "33" : meta.soft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: meta.color, fontSize: 12, fontWeight: "700" }}>{meta.label}</Text>
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
  colors,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  colors: typeof C;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: active ? C.teal : colors.white,
        borderWidth: 1,
        borderColor: active ? C.teal : colors.border,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "700", fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function LaboFile({
  dark = false,
  onBack,
}: {
  dark?: boolean;
  onBack: () => void;
}) {
  const colors = dark ? darkC : C;
  const [scope, setScope] = useState<Scope>("tous");
  const [items, setItems] = useState<ExamenItem[]>([]);
  const [bons, setBons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [depositBon, setDepositBon] = useState<any | null>(null);
  const [depositText, setDepositText] = useState("");
  const [depositStatut, setDepositStatut] = useState<"normal" | "eleve" | "critique">("normal");
  const [depositFile, setDepositFile] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const closeUpload = () => {
    setShowUpload(false);
    setBusy(false);
  };

  const openUpload = () => {
    setForm({ ...EMPTY_FORM, date: todayISO() });
    setFile(null);
    setShowUpload(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let list: ExamenItem[] = [];
      if (scope === "mes") list = await api.mesUploadsExamens();
      else if (scope === "incomplets") list = await api.examensACompleter();
      else list = await api.examensList();
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a, b) => {
        const rank = (s?: string) => (s === "critique" ? 0 : s === "eleve" ? 1 : 2);
        const d = rank(a.statut) - rank(b.statut);
        if (d !== 0) return d;
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
      setItems(arr);
      try {
        const d = await api.examOrders({ en_attente: 1 });
        const list = (d as any)?.results || d || [];
        setBons(Array.isArray(list) ? list : []);
      } catch {
        setBons([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const { refreshControl } = usePullRefresh({
    refetch: [() => load()],
    progressBackgroundColor: colors.white,
  });

  React.useEffect(() => {
    void load();
  }, [load]);

  const critCount = useMemo(
    () => items.filter((x) => x.statut === "critique").length,
    [items]
  );

  const pickFile = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setFile({
      uri: asset.uri,
      type: asset.mimeType || "image/jpeg",
      name: asset.fileName || `examen-${Date.now()}.jpg`,
    });
  };

  const submit = async () => {
    if (!form.patient.trim() || !form.type_examen.trim()) {
      appAlert("Champs requis", "Choisissez un patient et le type d'examen.");
      return;
    }
    setBusy(true);
    try {
      await api.createExamenMultipart(
        {
          patient: form.patient.trim(),
          type_examen: form.type_examen.trim(),
          categorie: form.categorie,
          date: form.date || todayISO(),
          statut: form.statut,
          resultat_texte: form.resultat_texte,
        },
        file
      );
      closeUpload();
      await load();
      appAlert("OK", "Examen enregistré.");
    } catch (e: any) {
      appAlert("Erreur", e?.message || "Échec upload examen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title="File labo"
          subtitle="Examens & résultats"
          onBack={onBack}
          right={
            <Pressable
              onPress={openUpload}
              accessibilityRole="button"
              accessibilityLabel="Nouvel examen"
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {critCount > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.emergencySoft,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.emergency + "44",
              }}
            >
              <Ionicons name="warning" size={18} color={colors.emergency} />
              <Text style={{ color: colors.emergency, fontWeight: "700", flex: 1 }}>
                {critCount} résultat{critCount > 1 ? "s" : ""} critique
                {critCount > 1 ? "s" : ""}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip active={scope === "tous"} label="Tous" onPress={() => setScope("tous")} colors={colors} />
            <Chip
              active={scope === "mes"}
              label="Mes uploads"
              onPress={() => setScope("mes")}
              colors={colors}
            />
            <Chip
              active={scope === "incomplets"}
              label="À compléter"
              onPress={() => setScope("incomplets")}
              colors={colors}
            />
          </View>

          <Button
            title="Nouvel examen"
            icon="cloud-upload-outline"
            color={C.teal}
            onPress={openUpload}
          />
        </View>

        {bons.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Bons en attente</Text>
            {bons.map((b: any) => (
              <Card key={b.id} colors={colors} style={{ gap: 8 }}>
                <Text style={{ fontWeight: "800", color: colors.text }}>
                  Bon #{b.id} · {b.patient_nom}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {b.statut_label || b.statut} · {(b.lignes || []).map((l: any) => l.type_examen).join(", ")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {b.statut === "demande" ? (
                    <Button
                      title="Marquer reçu"
                      compact
                      color={C.teal}
                      onPress={async () => {
                        try {
                          await api.examOrderAction(b.id, "recevoir");
                          void load();
                        } catch (e: any) {
                          appAlert("Erreur", e.message);
                        }
                      }}
                    />
                  ) : null}
                  {b.statut === "recu" || b.statut === "demande" ? (
                    <Button
                      title="Démarrer"
                      compact
                      outline
                      color={C.teal}
                      onPress={async () => {
                        try {
                          await api.examOrderAction(b.id, "demarrer");
                          void load();
                        } catch (e: any) {
                          appAlert("Erreur", e.message);
                        }
                      }}
                    />
                  ) : null}
                  <Button
                    title="Déposer un résultat"
                    compact
                    outline
                    color={C.blue}
                    onPress={() => {
                      setDepositBon(b);
                      setDepositText("");
                      setDepositStatut("normal");
                      setDepositFile(null);
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {loading && items.length === 0 ? (
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
              <EmptyState
                icon="flask-outline"
                title="Aucun examen"
                subtitle="Ajoutez un résultat via « Nouvel examen »."
                dark={!!dark}
              />
            }
            renderItem={({ item: x, index }) => {
              const critique = x.statut === "critique";
              return (
                <StaggerItem index={index}>
                  <Card
                    colors={colors}
                    decor={critique ? "none" : "soft"}
                    style={{
                      gap: 6,
                      borderColor: critique ? colors.emergency + "66" : colors.border,
                      backgroundColor: critique ? colors.emergencySoft : colors.white,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        {critique ? (
                          <Ionicons name="warning" size={16} color={colors.emergency} />
                        ) : null}
                        <Text
                          style={{ color: colors.text, fontWeight: "800", flexShrink: 1 }}
                          numberOfLines={2}
                        >
                          {x.type_examen || "Examen"}
                        </Text>
                      </View>
                      <StatusPill statut={x.statut} dark={!!dark} />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {x.patient_nom || `Patient #${x.patient}`}
                      {x.patient_npi ? ` · NPI ${x.patient_npi}` : ""}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {x.categorie_label || x.categorie || "-"}
                      {" · "}
                      {x.date ? new Date(x.date).toLocaleDateString("fr-FR") : "-"}
                    </Text>
                    {x.resultat_texte ? (
                      <Text style={{ color: colors.text, marginTop: 4 }} numberOfLines={3}>
                        {x.resultat_texte}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.amber, fontSize: 12, marginTop: 4 }}>
                        Résultat texte manquant
                      </Text>
                    )}
                    {!x.fichier_url ? (
                      <Text style={{ color: colors.amber, fontSize: 12 }}>Sans fichier</Text>
                    ) : null}
                    {!x.annule ? (
                      <Button
                        title="Annuler l'examen"
                        icon="close-circle-outline"
                        color={colors.muted}
                        compact
                        style={{ marginTop: 8 }}
                        onPress={() => {
                          appAlert(
                            "Annuler",
                            "Annuler cet examen ? Il disparaîtra de la file.",
                            [
                              { text: "Annuler", style: "cancel" },
                              {
                                text: "Oui, annuler",
                                style: "destructive",
                                onPress: async () => {
                                  try {
                                    await api.annulerExamen(x.id);
                                    await load();
                                  } catch (e: any) {
                                    appAlert("Erreur", e?.message || "Échec");
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      />
                    ) : null}
                  </Card>
                </StaggerItem>
              );
            }}
          />
        )}

        <Modal
          visible={showUpload}
          animationType="slide"
          transparent
          onRequestClose={closeUpload}
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.65)",
              }}
              onPress={closeUpload}
            />
            <View
              style={{
                backgroundColor: colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: "90%",
                borderWidth: 1,
                borderColor: colors.border,
                paddingBottom: 28,
              }}
            >
              <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <IconBadge
                  name="flask-outline"
                  color={C.teal}
                  bg={dark ? "#1C2A2E" : C.lightTeal}
                  size={40}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>
                    Nouvel examen
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Upload résultat / fichier
                  </Text>
                </View>
                <PressScale onPress={closeUpload} style={{ padding: 6 }}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </PressScale>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  Patient
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: -6 }}>
                  Recherche par nom ou NPI - pas d'identifiant technique
                </Text>
                <PatientSelectSearch
                  value={form.patient}
                  onChange={(patient) => setForm({ ...form, patient })}
                  dark={!!dark}
                  placeholder="Nom ou NPI du patient…"
                />
                <Field
                  label="Type d'examen"
                  value={form.type_examen}
                  onChangeText={(type_examen) => setForm({ ...form, type_examen })}
                  placeholder="NFS, CRP, radio…"
                  colors={colors}
                />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  Catégorie
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {(["analyses", "imagerie", "autres"] as const).map((c) => (
                    <Chip
                      key={c}
                      active={form.categorie === c}
                      label={c.charAt(0).toUpperCase() + c.slice(1)}
                      onPress={() => setForm({ ...form, categorie: c })}
                      colors={colors}
                    />
                  ))}
                </View>
                <Field
                  label="Date"
                  value={form.date}
                  onChangeText={(date) => setForm({ ...form, date })}
                  placeholder="AAAA-MM-JJ"
                  colors={colors}
                />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Statut</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {(["normal", "eleve", "critique"] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setForm({ ...form, statut: s })}
                      style={{
                        borderWidth: form.statut === s ? 2 : 0,
                        borderColor: STATUT_META[s].color,
                        borderRadius: 999,
                      }}
                    >
                      <StatusPill statut={s} dark={!!dark} />
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  Résultat texte
                </Text>
                <TextInput
                  value={form.resultat_texte}
                  onChangeText={(resultat_texte) => setForm({ ...form, resultat_texte })}
                  placeholder="Saisir le résultat…"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{
                    minHeight: 88,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: dark ? colors.bg : colors.white,
                    textAlignVertical: "top",
                  }}
                />
                <Button
                  title={file ? `Fichier : ${file.name}` : "Joindre un fichier / photo"}
                  icon="attach-outline"
                  outline
                  color={C.teal}
                  onPress={pickFile}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Annuler"
                      outline
                      color={colors.muted}
                      onPress={closeUpload}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Enregistrer l'examen"
                      icon="checkmark-circle-outline"
                      loading={busy}
                      color={C.teal}
                      onPress={submit}
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!depositBon}
          animationType="slide"
          transparent
          onRequestClose={() => setDepositBon(null)}
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.65)",
              }}
              onPress={() => setDepositBon(null)}
            />
            <View
              style={{
                backgroundColor: colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: "88%",
                paddingBottom: 28,
              }}
            >
              <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>
                  Déposer un résultat
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  Bon #{depositBon?.id} · {depositBon?.patient_nom}
                </Text>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 32 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {(depositBon?.lignes || []).map((l: any) => l.type_examen).join(", ")}
                </Text>
                <TextInput
                  value={depositText}
                  onChangeText={setDepositText}
                  placeholder="Texte du résultat…"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{
                    minHeight: 100,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {(["normal", "eleve", "critique"] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setDepositStatut(s)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: depositStatut === s ? C.teal : colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {s === "eleve" ? "Élevé" : s === "critique" ? "Critique" : "Normal"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  title={depositFile ? depositFile.name || "Pièce jointe" : "Joindre un fichier (optionnel)"}
                  outline
                  color={C.teal}
                  icon="attach-outline"
                  onPress={async () => {
                    const res = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.All,
                      quality: 0.85,
                    });
                    if (res.canceled || !res.assets?.[0]) return;
                    const asset = res.assets[0];
                    setDepositFile({
                      uri: asset.uri,
                      type: asset.mimeType || "image/jpeg",
                      name: asset.fileName || `resultat-${Date.now()}.jpg`,
                    });
                  }}
                />
                <Button
                  title="Enregistrer le résultat"
                  loading={busy}
                  color={C.teal}
                  onPress={async () => {
                    if (!depositText.trim() && !depositFile) {
                      appAlert("Résultat", "Saisissez un texte ou joignez un fichier.");
                      return;
                    }
                    const ligne =
                      (depositBon?.lignes || []).find((l: any) => !l.has_resultat) ||
                      depositBon?.lignes?.[0];
                    setBusy(true);
                    try {
                      await api.deposerResultat(
                        depositBon.id,
                        {
                          ligne: ligne?.id ? String(ligne.id) : "",
                          type_examen: ligne?.type_examen || "",
                          categorie: ligne?.categorie || "analyses",
                          resultat_texte: depositText.trim(),
                          statut: depositStatut,
                        },
                        depositFile
                      );
                      setDepositBon(null);
                      setDepositText("");
                      setDepositFile(null);
                      void load();
                    } catch (e: any) {
                      appAlert("Erreur", e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScreenEnter>
    </BrandBackground>
  );
}
