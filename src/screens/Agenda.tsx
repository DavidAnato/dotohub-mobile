import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { appAlert } from "../components/AppDialog";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Button, Card, Field, Header, SectionLabel } from "../ui";
import { C, ProUser, darkC } from "../theme";
import { api } from "../api";
import {
  BrandBackground,
  EmptyState,
  IconBadge,
  ScreenEnter,
  StaggerItem,
  hapticSuccess,
} from "../motion";
import {
  DateTimePickerField,
  defaultRdvDate,
  toIsoLocal,
} from "../components/DateTimePickerField";
import PatientSelectSearch from "../components/PatientSelectSearch";
import { Avatar } from "../components/Avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePullRefresh } from "../hooks/usePullRefresh";

/** Création / gestion RDV : médecins, réceptionniste, admin */
const WRITE_ROLES = new Set(["medecin", "receptionniste", "admin"]);
const READ_ROLES = new Set(["medecin", "receptionniste", "admin", "infirmier"]);

function statutColor(statut: string) {
  if (statut === "annule") return C.emergency;
  if (statut === "termine") return C.muted;
  if (statut === "confirme") return C.teal;
  return C.navy;
}

export default function Agenda({
  user,
  dark = false,
}: {
  user: ProUser;
  dark?: boolean;
}) {
  const colors = dark ? darkC : C;
  const navigation = useNavigation<any>();
  const canWrite = WRITE_ROLES.has(user.role);
  const canRead = READ_ROLES.has(user.role) || canWrite;
  const qc = useQueryClient();

  const apptsQ = useQuery({
    queryKey: ["appointments"],
    enabled: canRead,
    queryFn: async () => {
      const list = await api.appointments();
      return Array.isArray(list) ? list : [];
    },
  });
  const items = apptsQ.data || [];
  const loading = apptsQ.isLoading && !apptsQ.data;

  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [motif, setMotif] = useState("");
  const [debut, setDebut] = useState<Date>(() => defaultRdvDate());
  const [rdvMode, setRdvMode] = useState<"medecin" | "reception">("medecin");
  const [medecinId, setMedecinId] = useState("");
  const [medecins, setMedecins] = useState<{ id: number; full_name?: string }[]>([]);
  const isReception = user.role === "receptionniste";
  const isMedecin = user.role === "medecin";

  const load = useCallback(async () => {
    if (!canRead) return;
    await qc.invalidateQueries({ queryKey: ["appointments"] });
  }, [canRead, qc]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (canWrite && (isReception || user.role === "admin")) {
        void api.listMedecinsRdv().then((list) => setMedecins(Array.isArray(list) ? list : []));
      }
    }, [load, canWrite, isReception, user.role])
  );

  const upcoming = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  }, [items]);

  const create = async () => {
    const pid = Number(patientId);
    if (!pid) {
      appAlert("Patient requis", "Sélectionnez un patient.");
      return;
    }
    if (isReception && rdvMode === "medecin" && !medecinId) {
      appAlert("Médecin", "Choisissez un médecin ou RDV réception.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        patient: pid,
        debut: toIsoLocal(debut),
        motif: motif.trim() || "Consultation",
      };
      if (isMedecin) body.professionnel = user.id;
      else if ((isReception || user.role === "admin") && rdvMode === "medecin" && medecinId) {
        body.professionnel = Number(medecinId);
      }
      await api.createAppointment(body);
      setPatientId("");
      setMotif("");
      setDebut(defaultRdvDate());
      setMedecinId("");
      setRdvMode("medecin");
      setShowForm(false);
      hapticSuccess();
      await load();
    } catch (e: any) {
      appAlert("Erreur", e.message || "Création impossible");
    } finally {
      setBusy(false);
    }
  };

  const setStatut = (id: number, statut: string, label: string) => {
    appAlert(label, "Confirmer cette action ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        style: statut === "annule" ? "destructive" : "default",
        onPress: async () => {
          try {
            await api.updateAppointment(id, { statut });
            hapticSuccess();
            await load();
          } catch (e: any) {
            appAlert("Erreur", e.message || "Mise à jour impossible");
          }
        },
      },
    ]);
  };

  const cancelForm = () => {
    setPatientId("");
    setMotif("");
    setDebut(defaultRdvDate());
    setMedecinId("");
    setRdvMode("medecin");
    setShowForm(false);
  };

  const { refreshControl } = usePullRefresh({
    refetch: [() => load()],
    progressBackgroundColor: colors.white,
  });

  if (!canRead) {
    return (
      <BrandBackground dark={dark}>
        <Header title="Agenda" subtitle="Rendez-vous" />
        <EmptyState
          icon="calendar-outline"
          title="Agenda non disponible"
          subtitle="Votre rôle n'a pas accès à l'agenda des rendez-vous."
          dark={dark}
        />
      </BrandBackground>
    );
  }

  return (
    <BrandBackground dark={dark}>
      <ScreenEnter>
        <Header title="Agenda" subtitle={`${user.role_label} · RDV structure`} />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
        >
          <StaggerItem index={0}>
            <Card
              colors={colors}
              decor="navy"
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <IconBadge name="calendar-outline" color="#fff" bg={C.navy} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                  {upcoming.filter((a) => a.statut !== "annule" && a.statut !== "termine").length}{" "}
                  actifs
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {canWrite ? "Création autorisée" : "Lecture seule"}
                </Text>
              </View>
              {canWrite ? (
                <Button
                  title={showForm ? "Fermer" : "RDV"}
                  icon={showForm ? "close-outline" : "add-circle-outline"}
                  outline={showForm}
                  compact
                  color={C.teal}
                  onPress={() => setShowForm((v) => !v)}
                />
              ) : null}
            </Card>
          </StaggerItem>

          {canWrite && showForm ? (
            <StaggerItem index={1}>
              <SectionLabel color={colors.navy}>Nouveau rendez-vous</SectionLabel>
              <Card colors={colors} style={{ gap: 8 }}>
                <PatientSelectSearch
                  value={patientId}
                  onChange={setPatientId}
                  dark={dark}
                  placeholder="Patient (nom ou NPI)…"
                />
                {(isReception || user.role === "admin") && (
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={() => setRdvMode("medecin")}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: rdvMode === "medecin" ? C.teal : colors.white,
                        borderWidth: 1,
                        borderColor: rdvMode === "medecin" ? C.teal : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: rdvMode === "medecin" ? "#fff" : colors.text,
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        Avec médecin
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRdvMode("reception");
                        setMedecinId("");
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: rdvMode === "reception" ? C.teal : colors.white,
                        borderWidth: 1,
                        borderColor: rdvMode === "reception" ? C.teal : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: rdvMode === "reception" ? "#fff" : colors.text,
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        RDV réception
                      </Text>
                    </Pressable>
                  </View>
                )}
                {(isReception || user.role === "admin") && rdvMode === "medecin" ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {medecins.map((m) => {
                      const active = String(m.id) === medecinId;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setMedecinId(String(m.id))}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: active ? C.teal : colors.border,
                            backgroundColor: active
                              ? dark
                                ? "#1C2A2E"
                                : C.lightTeal
                              : colors.white,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                            {m.full_name || `#${m.id}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <DateTimePickerField
                  label="Date et heure"
                  value={debut}
                  onChange={setDebut}
                  colors={colors}
                  minimumDate={new Date()}
                />
                <Field
                  label="Motif (optionnel)"
                  value={motif}
                  onChangeText={setMotif}
                  placeholder="Consultation, contrôle…"
                  colors={colors}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Annuler"
                      outline
                      color={colors.muted}
                      onPress={cancelForm}
                      disabled={busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Créer"
                      icon="calendar-outline"
                      onPress={create}
                      loading={busy}
                      color={C.navy}
                    />
                  </View>
                </View>
              </Card>
            </StaggerItem>
          ) : null}

          <SectionLabel color={colors.navy}>Liste des rendez-vous</SectionLabel>
          {!loading && upcoming.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Aucun rendez-vous"
              subtitle={
                canWrite
                  ? "Créez un RDV avec le bouton RDV."
                  : "Aucun RDV planifié pour votre structure."
              }
              dark={dark}
            />
          ) : null}

          {upcoming.map((a, i) => (
            <StaggerItem key={a.id} index={i + 2}>
              <Card colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <Avatar
                    uri={a.patient_photo_url}
                    name={a.patient_name || `Patient #${a.patient}`}
                    size={40}
                    bg={C.navy}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15 }}>
                      {a.patient_name || `Patient #${a.patient}`}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                        fontFamily: "monospace",
                      }}
                    >
                      {a.patient_npi || ""}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 13, marginTop: 6, fontWeight: "600" }}>
                      {a.debut
                        ? new Date(a.debut).toLocaleString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {a.motif || "Sans motif"}
                      {a.structure_nom ? ` · ${a.structure_nom}` : ""}
                      {a.professionnel_nom ? ` · ${a.professionnel_nom}` : ""}
                    </Text>
                    <Text
                      style={{
                        color: statutColor(a.statut),
                        fontWeight: "800",
                        marginTop: 8,
                        fontSize: 12,
                      }}
                    >
                      {a.statut === "planifie" && a.professionnel
                        ? "À confirmer"
                        : a.statut_label || a.statut}
                    </Text>
                  </View>
                </View>
                    {canWrite && a.statut !== "annule" && a.statut !== "termine" ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {(isMedecin || user.role === "admin") &&
                    a.statut === "planifie" &&
                    (a.professionnel === user.id || user.role === "admin") ? (
                      <Button
                        title="Confirmer"
                        icon="checkmark-circle-outline"
                        compact
                        color={C.teal}
                        onPress={async () => {
                          try {
                            await api.confirmerAppointment(a.id);
                            hapticSuccess();
                            await load();
                          } catch (e: any) {
                            appAlert("Erreur", e.message || "Confirmation impossible");
                          }
                        }}
                      />
                    ) : null}
                    {(isMedecin || user.role === "admin") && a.statut === "confirme" ? (
                      <Button
                        title="Démarrer la consultation"
                        icon="play-circle-outline"
                        compact
                        color={C.blue}
                        onPress={async () => {
                          try {
                            const c = await api.demarrerConsultation(a.id);
                            hapticSuccess();
                            await load();
                            const pid = c?.patient || a.patient;
                            if (pid) {
                              navigation.getParent()?.navigate("Patient", { patientId: pid });
                            }
                          } catch (e: any) {
                            appAlert("Erreur", e.message || "Impossible de démarrer");
                          }
                        }}
                      />
                    ) : null}
                    <Button
                      title="Terminé"
                      icon="checkmark-done-outline"
                      outline
                      compact
                      color={C.teal}
                      onPress={() => setStatut(a.id, "termine", "Marquer terminé")}
                    />
                    <Button
                      title="Annuler"
                      icon="close-circle-outline"
                      outline
                      compact
                      color={C.emergency}
                      onPress={() => setStatut(a.id, "annule", "Annuler le RDV")}
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
