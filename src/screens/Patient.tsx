import React, { useEffect, useState } from "react";
import { Pressable, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { appAlert } from "../components/AppDialog";
import { C, darkC, ProUser, ROLE_TABS, TAB_LABELS, brandNavy, onBrand } from "../theme";
import { api } from "../api";
import {
  useConsultations,
  useConstantes,
  useExamens,
  useOrdonnances,
  usePatientQuery,
} from "../queries/hooks";
import { Button, Card, Header, UrgenceBanner } from "../ui";
import { ConsentWaitingView } from "../components/ConsentWaiting";
import {
  DateTimePickerField,
  defaultRdvDate,
  toIsoLocal,
} from "../components/DateTimePickerField";
import { useAppStore } from "../store/appStore";
import {
  BrandBackground,
  EmptyState,
  IconBadge,
  PressScale,
  ScreenEnter,
  SkeletonList,
  StaggerItem,
} from "../motion";
import { Avatar } from "../components/Avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { qk } from "../queries/keys";
import {
  BON_STATUTS,
  MEDICAMENT_FORMES,
  MEDICAMENT_MOMENTS,
  PRISE_EN_CHARGE,
  SPECIALITES,
  emptyMedLine,
  nowDateISO,
  nowISO,
  summarizeMed,
  type MedLine,
} from "../constants";

/** Création RDV : médecins, réceptionniste, admin */
const RDV_WRITE_ROLES = new Set(["medecin", "receptionniste", "admin"]);
const FULL_ACCESS_ROLES = new Set([
  "medecin",
  "infirmier",
  "pharmacien",
  "laborantin",
  "receptionniste",
]);

function pickNextAppointment(list: any[] | undefined) {
  if (!list?.length) return null;
  const now = Date.now();
  const upcoming = list
    .filter((a) => a.statut !== "annule" && a.statut !== "termine" && a.debut)
    .map((a) => ({ a, t: new Date(a.debut).getTime() }))
    .filter((x) => !Number.isNaN(x.t) && x.t >= now - 60 * 60 * 1000)
    .sort((x, y) => x.t - y.t);
  return upcoming[0]?.a ?? null;
}

export default function PatientDossier({
  patientId,
  user,
  dark,
  onBack,
}: {
  patientId: number;
  user: ProUser;
  dark?: boolean;
  onBack: () => void;
}) {
  const colors = dark ? darkC : C;
  const tabs = ROLE_TABS[user.role] || ["constantes"];
  const [tab, setTab] = useState(tabs[0]);
  const { data: patient, isLoading: loading, refetch } = usePatientQuery(patientId);
  const qc = useQueryClient();
  const { data: patientAppts } = useQuery({
    queryKey: ["appointments", "patient", patientId],
    queryFn: async () => {
      const list = await api.appointments({ patient: patientId });
      return Array.isArray(list) ? list : [];
    },
  });
  const nextRdv = pickNextAppointment(patientAppts);
  const storeOnline = useAppStore((s) => s.online);
  const offline = !storeOnline && !!(patient as any)?._offline;
  const fromCache = !!(patient as any)?._fromCache || (!!offline && !!(patient as any)?._offline);
  const [requesting, setRequesting] = useState(false);
  const [showRdv, setShowRdv] = useState(false);
  const [rdvBusy, setRdvBusy] = useState(false);
  const [motif, setMotif] = useState("Consultation");
  const [debut, setDebut] = useState<Date>(() => defaultRdvDate());
  const [rdvMode, setRdvMode] = useState<"medecin" | "reception">("medecin");
  const [medecinId, setMedecinId] = useState("");
  const [medecins, setMedecins] = useState<{ id: number; full_name?: string }[]>([]);
  const canWriteRdv = RDV_WRITE_ROLES.has(user.role);
  const isReception = user.role === "receptionniste";

  useEffect(() => {
    setTab(tabs[0]);
    setShowRdv(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, user.role]);

  useEffect(() => {
    if (!canWriteRdv || (!isReception && user.role !== "admin")) return;
    void api.listMedecinsRdv().then((list) => setMedecins(Array.isArray(list) ? list : []));
  }, [canWriteRdv, isReception, user.role]);

  const needsAccess = !!patient?.consent?.required && !patient?.consent?.granted;
  const pending = !!patient?.consent?.pending;
  const canRequestFull =
    needsAccess &&
    user.role !== "admin" &&
    patient?.consent?.can_request !== false &&
    FULL_ACCESS_ROLES.has(user.role);

  useEffect(() => {
    if (!needsAccess || !pending || offline) return;
    const t = setInterval(() => refetch(), 4000);
    return () => clearInterval(t);
  }, [needsAccess, pending, offline, refetch]);

  const requestFullAccess = async () => {
    setRequesting(true);
    try {
      await api.requestAccess(patientId);
      await refetch();
    } catch (e: any) {
      appAlert("Erreur", e.message || "Impossible de demander l'accès.");
    } finally {
      setRequesting(false);
    }
  };

  const createRdv = async () => {
    if (isReception && rdvMode === "medecin" && !medecinId) {
      appAlert("Médecin", "Choisissez un médecin, ou passez en RDV réception.");
      return;
    }
    setRdvBusy(true);
    try {
      const body: Record<string, unknown> = {
        patient: patientId,
        debut: toIsoLocal(debut),
        motif: motif.trim() || "Consultation",
      };
      if (user.role === "medecin") {
        body.professionnel = user.id;
      } else if ((isReception || user.role === "admin") && rdvMode === "medecin" && medecinId) {
        body.professionnel = Number(medecinId);
      }
      await api.createAppointment(body);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      setShowRdv(false);
      setMotif("Consultation");
      setDebut(defaultRdvDate());
      setMedecinId("");
      setRdvMode("medecin");
      appAlert(
        "RDV créé",
        isReception && rdvMode === "medecin"
          ? "Le médecin a été notifié — en attente de confirmation."
          : "Le rendez-vous a été enregistré."
      );
    } catch (e: any) {
      appAlert("Erreur", e.message || "Création impossible");
    } finally {
      setRdvBusy(false);
    }
  };

  const consultations = useConsultations(
    tab === "historique" && !offline && !needsAccess ? patientId : undefined
  );
  const ordonnances = useOrdonnances(
    tab === "ordonnances" && !offline && !needsAccess ? patientId : undefined
  );
  const examens = useExamens(tab === "examens" && !offline && !needsAccess ? patientId : undefined);
  const constantes = useConstantes(
    tab === "constantes" && !offline && !needsAccess ? patientId : undefined
  );
  const [bons, setBons] = useState<any[]>([]);

  useEffect(() => {
    if (tab !== "examens" || offline || needsAccess) return;
    api
      .examOrders({ patient: patientId })
      .then((d: any) => {
        const list = d?.results || d || [];
        setBons(Array.isArray(list) ? list : []);
      })
      .catch(() => setBons([]));
  }, [tab, patientId, offline, needsAccess]);

  let items: any[] = [];
  let tabLoading = false;
  if (tab === "historique") {
    items = (consultations.data as any[]) || [];
    tabLoading = consultations.isLoading;
  } else if (tab === "ordonnances") {
    items = (ordonnances.data as any[]) || [];
    tabLoading = ordonnances.isLoading;
  } else if (tab === "examens") {
    items = (examens.data as any[]) || [];
    tabLoading = examens.isLoading;
  } else if (tab === "constantes") {
    items = (constantes.data as any[]) || [];
    tabLoading = constantes.isLoading;
  } else if (tab === "assurance") {
    items = patient?.assurance ? [patient.assurance] : [];
  }

  const { refreshControl } = usePullRefresh({
    keys: [
      qk.patient(patientId),
      qk.consultations(patientId),
      qk.ordonnances(patientId),
      qk.examens(patientId),
      qk.constantes(patientId),
    ],
    refetch: [() => refetch()],
  });

  if (loading && !patient) {
    return (
      <BrandBackground dark={!!dark}>
        <Header title="Dossier patient" onBack={onBack} />
        <View style={{ padding: 16 }}>
          <SkeletonList count={4} dark={!!dark} />
        </View>
      </BrandBackground>
    );
  }

  if (!patient) {
    return (
      <BrandBackground dark={!!dark}>
        <Header title="Dossier patient" onBack={onBack} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="alert-circle-outline" title="Dossier introuvable" dark={!!dark} />
        </View>
      </BrandBackground>
    );
  }

  const emergency = !!patient?.consent?.emergency;
  const basicSubtitle = `${patient.npi || ""}${
    patient.date_naissance ? ` · ${patient.date_naissance}` : ""
  }`;

  const closeRdv = () => setShowRdv(false);

  const rdvHeaderRight = canWriteRdv ? (
    <Pressable
      onPress={() => setShowRdv(true)}
      accessibilityRole="button"
      accessibilityLabel="Planifier un rendez-vous"
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
      }}
    >
      <Ionicons name="calendar-outline" size={20} color={onBrand} />
    </Pressable>
  ) : null;

  const rdvModal =
    canWriteRdv ? (
      <Modal
        visible={showRdv}
        animationType="slide"
        transparent
        onRequestClose={closeRdv}
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
            onPress={closeRdv}
          />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "88%",
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
                name="calendar-outline"
                color={C.teal}
                bg={dark ? "#1C2A2E" : C.lightTeal}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>
                  Planifier un RDV
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  Avec {patient?.full_name || "le patient"}
                </Text>
              </View>
              <PressScale onPress={closeRdv} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </PressScale>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
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
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    Médecin
                  </Text>
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
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Le médecin sera notifié et devra confirmer.
                  </Text>
                </View>
              ) : null}
              <DateTimePickerField
                label="Date et heure"
                value={debut}
                onChange={setDebut}
                colors={colors}
                minimumDate={new Date()}
              />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Motif</Text>
              <TextInput
                value={motif}
                onChangeText={setMotif}
                placeholder="Consultation"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  minHeight: 48,
                  color: colors.text,
                  backgroundColor: dark ? colors.bg : colors.white,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Annuler"
                    outline
                    color={colors.muted}
                    onPress={closeRdv}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Enregistrer le RDV"
                    icon="checkmark-circle-outline"
                    onPress={createRdv}
                    loading={rdvBusy}
                    color={brandNavy}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    ) : null;

  if (needsAccess && pending) {
    return (
      <BrandBackground dark={!!dark}>
        <Header
          title={patient.full_name || "Patient"}
          subtitle={basicSubtitle}
          onBack={onBack}
          right={rdvHeaderRight}
        />
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
          <Avatar uri={patient.photo_url} name={patient.full_name} size={56} />
        </View>
        {rdvModal}
        <ConsentWaitingView
          patientName={patient.full_name}
          role={user.role}
          dark={dark}
          onCancel={async () => {
            const accessId = patient?.consent?.access_request_id;
            if (accessId) {
              try {
                await api.cancelAccessRequest(accessId);
              } catch (e: any) {
                appAlert("Erreur", e.message || "Annulation impossible");
                return;
              }
            }
            onBack();
          }}
        />
      </BrandBackground>
    );
  }

  if (needsAccess && !pending) {
    return (
      <BrandBackground dark={!!dark}>
        <Header
          title={patient.full_name || "Patient"}
          subtitle={basicSubtitle}
          onBack={onBack}
          right={rdvHeaderRight}
        />
        <ScrollView
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          refreshControl={refreshControl}
        >
          {patient.urgence ? <UrgenceBanner u={patient.urgence} colors={colors} /> : null}
          <NextRdvCard
            nextRdv={nextRdv}
            colors={colors}
            canWrite={canWriteRdv}
            onPlan={() => setShowRdv(true)}
          />
          <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 8 }}>
            <Card colors={colors}>
              <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
                Infos de base
              </Text>
              <Text style={{ color: colors.muted, marginBottom: 12 }}>
                {patient.consent?.message ||
                  "Demandez l'accès complet pour consulter le dossier médical."}
              </Text>
              {canRequestFull ? (
                <Button
                  title={requesting ? "Envoi…" : "Demander l'accès"}
                  icon="lock-open-outline"
                  onPress={requestFullAccess}
                  loading={requesting}
                  color={C.navy}
                />
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Votre rôle n'autorise pas la demande d'accès au dossier complet.
                </Text>
              )}
            </Card>
          </View>
        </ScrollView>
        {rdvModal}
      </BrandBackground>
    );
  }

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title={patient.full_name || "Patient"}
          subtitle={`${patient.npi || ""} · ${user.role_label}`}
          onBack={onBack}
          right={rdvHeaderRight}
        />
        <View style={{ height: 16 }} />
        {emergency ? <ConsentWaitingView emergency dark={dark} /> : null}
        {offline ? (
          <Text
            style={{
              color: colors.amber,
              fontWeight: "700",
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            Mode cache hors ligne
          </Text>
        ) : fromCache ? (
          <Text
            style={{
              color: colors.muted,
              fontWeight: "600",
              paddingHorizontal: 16,
              marginBottom: 8,
              fontSize: 12,
            }}
          >
            Dossier en cache (sync serveur indisponible)
          </Text>
        ) : null}
        {rdvModal}
        <NextRdvCard
          nextRdv={nextRdv}
          colors={colors}
          canWrite={canWriteRdv}
          onPlan={() => setShowRdv(true)}
        />

        <View style={{ height: 40, marginBottom: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: 12,
              gap: 6,
              alignItems: "center",
              height: 40,
            }}
          >
            {tabs.map((t) => {
              const active = tab === t;
              return (
                <PressScale
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    height: 36,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 99,
                    backgroundColor: active ? C.blue : colors.white,
                    borderWidth: 1,
                    borderColor: active ? C.blue : colors.border,
                    alignSelf: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? onBrand : colors.muted,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {TAB_LABELS[t] || t}
                  </Text>
                </PressScale>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          refreshControl={refreshControl}
        >
          {patient.urgence ? (
            <UrgenceBanner
              u={patient.urgence}
              colors={colors}
              style={{ marginHorizontal: 0, marginTop: 0, marginBottom: 0 }}
            />
          ) : null}
          {tab === "examens" && bons.length > 0 ? (
            <Card colors={colors} style={{ gap: 8 }}>
              <Text style={{ fontWeight: "800", color: colors.text }}>Demandes d'examens</Text>
              {bons.map((b: any) => {
                const st = BON_STATUTS[b.statut] || { label: b.statut_label || b.statut, color: C.blue };
                return (
                  <View key={b.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Bon #{b.id}</Text>
                    <Text style={{ color: st.color, fontSize: 12, fontWeight: "700" }}>{st.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {(b.lignes || []).map((l: any) => l.type_examen).join(", ")}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : null}
          {tabLoading && items.length === 0 ? (
            <SkeletonList count={3} dark={!!dark} />
          ) : items.length === 0 ? (
            <EmptyState icon="document-outline" title="Aucune donnée" dark={!!dark} />
          ) : (
            items.map((item: any, idx: number) => (
              <StaggerItem key={item.id || idx} index={idx}>
                <Card colors={colors}>
                  {tab === "historique" && (
                    <>
                      <Text style={{ fontWeight: "800", color: colors.text }}>
                        {item.titre ||
                          [item.specialite || "Consultation", item.medecin_nom, item.structure_nom]
                            .filter(Boolean)
                            .join(" — ") ||
                          "Consultation"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        {item.date ? new Date(item.date).toLocaleDateString("fr-FR") : ""}
                        {item.appointment_id ? " · Liée à un RDV" : " · Sans RDV"}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 13, marginTop: 6, fontWeight: "700" }}>
                        {item.medecin_nom || "Médecin non renseigné"}
                      </Text>
                      {item.medecin_telephone ? (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          Tél. {item.medecin_telephone}
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.text, fontSize: 13, marginTop: 2 }}>
                        {item.structure_nom || "Structure non renseignée"}
                      </Text>
                      {(user.role === "medecin" || user.role === "admin") && !item.annule ? (
                        <Button
                          title="Annuler la consultation"
                          icon="close-circle-outline"
                          color={colors.muted}
                          compact
                          style={{ marginTop: 10 }}
                          onPress={() => {
                            appAlert(
                              "Annuler",
                              "Annuler cette consultation ? Elle disparaîtra de l'historique.",
                              [
                                { text: "Annuler", style: "cancel" },
                                {
                                  text: "Oui, annuler",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await api.annulerConsultation(item.id);
                                      consultations.refetch();
                                    } catch (e: any) {
                                      appAlert("Erreur", e.message);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      ) : null}
                    </>
                  )}
                  {tab === "ordonnances" && (
                    <>
                      <Text style={{ fontWeight: "800", color: colors.text }}>
                        Ordonnance{" "}
                        {item.date ? `du ${new Date(item.date).toLocaleDateString("fr-FR")}` : ""}
                      </Text>
                      {item.medecin_nom ? (
                        <Text style={{ color: colors.text, fontSize: 13, marginTop: 4, fontWeight: "700" }}>
                          {item.medecin_nom}
                        </Text>
                      ) : null}
                      {item.medecin_telephone ? (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          Tél. {item.medecin_telephone}
                        </Text>
                      ) : null}
                      {item.structure_nom ? (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {item.structure_nom}
                        </Text>
                      ) : null}
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {item.statut_label || item.statut}
                      </Text>
                      {(item.medicaments || []).map((m: any) => (
                        <Text
                          key={m.id || m.nom}
                          style={{ color: colors.text, fontSize: 13, marginTop: 6, lineHeight: 19 }}
                        >
                          • {summarizeMed(m)}
                        </Text>
                      ))}
                      {item.instructions ? (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                          {item.instructions}
                        </Text>
                      ) : null}
                      {item.statut === "active" &&
                      (user.role === "medecin" || user.role === "admin") ? (
                        <Button
                          title="Annuler l'ordonnance"
                          icon="close-circle-outline"
                          color={colors.muted}
                          compact
                          style={{ marginTop: 10 }}
                          onPress={() => {
                            appAlert(
                              "Annuler",
                              "Annuler cette ordonnance ? Elle ne pourra plus être dispensée.",
                              [
                                { text: "Annuler", style: "cancel" },
                                {
                                  text: "Oui, annuler",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await api.annulerOrdonnance(item.id);
                                      ordonnances.refetch();
                                    } catch (e: any) {
                                      appAlert("Erreur", e.message);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      ) : null}
                      {item.statut === "active" && user.role === "pharmacien" ? (
                        <Button
                          title="Marquer dispensée"
                          icon="checkmark-circle-outline"
                          color={C.emerald}
                          compact
                          style={{ marginTop: 10 }}
                          onPress={() => {
                            appAlert("Dispenser", "Marquer cette ordonnance comme dispensée ?", [
                              { text: "Annuler", style: "cancel" },
                              {
                                text: "Oui",
                                onPress: async () => {
                                  try {
                                    await api.dispenser(item.id);
                                    ordonnances.refetch();
                                  } catch (e: any) {
                                    appAlert("Erreur", e.message);
                                  }
                                },
                              },
                            ]);
                          }}
                        />
                      ) : null}
                      {item.statut === "dispensee" && user.role === "pharmacien" ? (
                        <Button
                          title="Annuler la dispense"
                          icon="arrow-undo-outline"
                          color={colors.muted}
                          compact
                          style={{ marginTop: 10 }}
                          onPress={() => {
                            appAlert(
                              "Annuler la dispense",
                              "L'ordonnance redeviendra active. Continuer ?",
                              [
                                { text: "Annuler", style: "cancel" },
                                {
                                  text: "Oui",
                                  onPress: async () => {
                                    try {
                                      await api.annulerDispense(item.id);
                                      ordonnances.refetch();
                                    } catch (e: any) {
                                      appAlert("Erreur", e.message);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      ) : null}
                    </>
                  )}
                  {tab === "examens" && (
                    <>
                      <Text style={{ fontWeight: "800", color: colors.text }}>
                        {item.type_examen || "Examen"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{item.statut}</Text>
                      {(user.role === "laborantin" || user.role === "admin") && !item.annule ? (
                        <Button
                          title="Annuler l'examen"
                          icon="close-circle-outline"
                          color={colors.muted}
                          compact
                          style={{ marginTop: 10 }}
                          onPress={() => {
                            appAlert(
                              "Annuler",
                              "Annuler cet examen ? Il disparaîtra de la liste.",
                              [
                                { text: "Annuler", style: "cancel" },
                                {
                                  text: "Oui, annuler",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await api.annulerExamen(item.id);
                                      examens.refetch();
                                    } catch (e: any) {
                                      appAlert("Erreur", e.message);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      ) : null}
                    </>
                  )}
                  {tab === "constantes" && (
                    <>
                      <Text style={{ fontWeight: "800", color: colors.text }}>
                        {item.date
                          ? new Date(item.date).toLocaleDateString("fr-FR")
                          : "Constantes"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        TA {item.tension_systolique}/{item.tension_diastolique} · T°{" "}
                        {item.temperature || "—"}
                      </Text>
                    </>
                  )}
                  {tab === "assurance" && (
                    <>
                      <Text style={{ fontWeight: "800", color: colors.text }}>
                        {item.assureur || "—"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Police {item.num_police}
                      </Text>
                    </>
                  )}
                </Card>
              </StaggerItem>
            ))
          )}

          {!offline && !needsAccess && tab === "constantes" &&
            ["infirmier", "medecin", "ambulancier"].includes(user.role) && (
              <WriteConstantes
                patientId={patientId}
                colors={colors}
                onDone={() => constantes.refetch()}
              />
            )}
          {!offline && !needsAccess && tab === "historique" && user.role === "medecin" && (
            <WriteConsult
              patientId={patientId}
              user={user}
              colors={colors}
              onDone={() => consultations.refetch()}
            />
          )}
          {!offline && !needsAccess && tab === "ordonnances" &&
            (user.role === "medecin" || user.role === "admin") && (
              <WriteOrdo
                patientId={patientId}
                patientName={patient.full_name}
                dark={!!dark}
                colors={colors}
                onDone={() => ordonnances.refetch()}
              />
            )}
          {!offline && !needsAccess && tab === "examens" &&
            (user.role === "medecin" || user.role === "admin") && (
              <WriteBon
                patientId={patientId}
                patientName={patient.full_name}
                dark={!!dark}
                colors={colors}
                onDone={() => examens.refetch()}
              />
            )}
          {!offline && !needsAccess && tab === "examens" &&
            (user.role === "laborantin" || user.role === "admin") && (
              <WriteExamen
                patientId={patientId}
                patientName={patient.full_name}
                dark={!!dark}
                colors={colors}
                onDone={() => examens.refetch()}
              />
            )}
          {!offline &&
            !needsAccess &&
            tab === "assurance" &&
            (user.role === "receptionniste" ||
              user.role === "admin" ||
              !!patient?.access?.write?.assurance) && (
              <WriteAssurance
                patientId={patientId}
                initial={patient?.assurance}
                colors={colors}
                onDone={() => refetch()}
              />
            )}
        </ScrollView>
      </ScreenEnter>
    </BrandBackground>
  );
}

function NextRdvCard({
  nextRdv,
  colors,
  canWrite,
  onPlan,
}: {
  nextRdv: any;
  colors: any;
  canWrite: boolean;
  onPlan: () => void;
}) {
  const when = nextRdv?.debut
    ? new Date(nextRdv.debut).toLocaleString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <Card colors={colors} style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>
        PROCHAIN RDV
      </Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginTop: 4 }}>
        {when || "Aucun rendez-vous à venir"}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
        {nextRdv
          ? [nextRdv.professionnel_nom ? `Dr ${nextRdv.professionnel_nom}` : "Réception", nextRdv.structure_nom]
              .filter(Boolean)
              .join(" · ") || nextRdv.motif || "Consultation"
          : "Planifiez depuis cette fiche ou l'agenda"}
      </Text>
      {canWrite ? (
        <View style={{ marginTop: 10 }}>
          <Button
            title={nextRdv ? "Nouveau RDV" : "Planifier"}
            outline
            color={C.navy}
            onPress={onPlan}
          />
        </View>
      ) : null}
    </Card>
  );
}

function WriteConstantes({
  patientId,
  colors,
  onDone,
}: {
  patientId: number;
  colors: any;
  onDone: () => void;
}) {
  const [sys, setSys] = useState("120");
  const [dia, setDia] = useState("80");
  const [busy, setBusy] = useState(false);
  return (
    <Card colors={colors} style={{ gap: 8 }}>
      <Text style={{ fontWeight: "800", color: colors.text }}>Saisir constantes</Text>
      <TextInput
        value={sys}
        onChangeText={setSys}
        placeholder="Systolique"
        keyboardType="number-pad"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text }}
      />
      <TextInput
        value={dia}
        onChangeText={setDia}
        placeholder="Diastolique"
        keyboardType="number-pad"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text }}
      />
      <Button
        title="Enregistrer"
        loading={busy}
        color={C.blue}
        onPress={async () => {
          setBusy(true);
          try {
            await api.createConstante({
              patient: patientId,
              tension_systolique: Number(sys),
              tension_diastolique: Number(dia),
            });
            onDone();
          } catch (e: any) {
            appAlert("Erreur", e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

function WriteAssurance({
  patientId,
  initial,
  colors,
  onDone,
}: {
  patientId: number;
  initial?: any;
  colors: any;
  onDone: () => void;
}) {
  const [assureur, setAssureur] = useState(initial?.assureur || "");
  const [numPolice, setNumPolice] = useState(initial?.num_police || "");
  const [droits, setDroits] = useState(initial?.droits_valides ?? true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssureur(initial?.assureur || "");
    setNumPolice(initial?.num_police || "");
    setDroits(initial?.droits_valides ?? true);
  }, [initial?.assureur, initial?.num_police, initial?.droits_valides, initial?.id]);

  return (
    <Card colors={colors} style={{ gap: 8 }}>
      <Text style={{ fontWeight: "800", color: colors.text }}>
        {initial ? "Modifier l'assurance" : "Enregistrer l'assurance"}
      </Text>
      <TextInput
        value={assureur}
        onChangeText={setAssureur}
        placeholder="Assureur"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 10,
          color: colors.text,
        }}
      />
      <TextInput
        value={numPolice}
        onChangeText={setNumPolice}
        placeholder="N° de police"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 10,
          color: colors.text,
        }}
      />
      <Pressable
        onPress={() => setDroits((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
      >
        <Ionicons
          name={droits ? "checkbox" : "square-outline"}
          size={22}
          color={droits ? C.teal : colors.muted}
        />
        <Text style={{ color: colors.text, fontWeight: "600" }}>Droits valides</Text>
      </Pressable>
      <Button
        title="Enregistrer"
        loading={busy}
        color={C.blue}
        onPress={async () => {
          if (!assureur.trim()) return;
          setBusy(true);
          try {
            await api.updateAssurance(patientId, {
              assureur: assureur.trim(),
              num_police: numPolice.trim(),
              droits_valides: droits,
            });
            onDone();
          } catch (e: any) {
            appAlert("Erreur", e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {initial ? (
        <Button
          title="Retirer l'assurance"
          outline
          color={C.emergency}
          loading={busy}
          onPress={() => {
            appAlert("Retirer l'assurance", "La carte passera en Non assuré.", [
              { text: "Annuler", style: "cancel" },
              {
                text: "Retirer",
                style: "destructive",
                onPress: async () => {
                  setBusy(true);
                  try {
                    await api.deleteAssurance(patientId);
                    onDone();
                  } catch (e: any) {
                    appAlert("Erreur", e.message);
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ]);
          }}
        />
      ) : null}
    </Card>
  );
}

function WriteConsult({
  patientId,
  user,
  colors,
  onDone,
}: {
  patientId: number;
  user: ProUser;
  colors: any;
  onDone: () => void;
}) {
  const structures = user.structures || [];
  const principaleId = user.structure_principale;
  const defaultSpec = (user as ProUser & { specialite?: string }).specialite || "Médecine générale";
  const specOptions = SPECIALITES.includes(defaultSpec)
    ? SPECIALITES
    : [defaultSpec, ...SPECIALITES];
  const [type, setType] = useState("consultation");
  const [specialite, setSpecialite] = useState(defaultSpec);
  const [structure, setStructure] = useState(
    principaleId ? String(principaleId) : structures[0]?.id ? String(structures[0].id) : ""
  );
  const [motif, setMotif] = useState("");
  const [dx, setDx] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
  };

  return (
    <Card colors={colors} style={{ gap: 8 }}>
      <Text style={{ fontWeight: "800", color: colors.text }}>Nouvelle consultation</Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Spécialité</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {specOptions.map((s) => (
          <Pressable
            key={s}
            onPress={() => setSpecialite(s)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: specialite === s ? C.blue : colors.border,
              backgroundColor: specialite === s ? colors.lightBlue : colors.white,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Structure (obligatoire)</Text>
      {structures.length === 0 ? (
        <Text style={{ color: C.emergency, fontSize: 12 }}>
          Rattachez un hôpital dans Paramètres.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {structures.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setStructure(String(s.id))}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: structure === String(s.id) ? C.teal : colors.border,
                backgroundColor: structure === String(s.id) ? colors.lightTeal : colors.white,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{s.nom}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Type de prise en charge</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {PRISE_EN_CHARGE.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setType(t.value)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: type === t.value ? C.blue : colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={motif}
        onChangeText={setMotif}
        placeholder="Motif"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />
      <TextInput
        value={dx}
        onChangeText={setDx}
        placeholder="Diagnostic"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes / observations"
        placeholderTextColor={colors.muted}
        multiline
        style={{ ...inputStyle, minHeight: 64, textAlignVertical: "top" }}
      />
      <Button
        title="Enregistrer"
        loading={busy}
        color={C.blue}
        onPress={async () => {
          if (!structure) {
            appAlert("Structure", "Choisissez la structure de santé.");
            return;
          }
          setBusy(true);
          try {
            await api.createConsultation({
              patient: patientId,
              diagnostic: dx.trim(),
              motif: motif.trim(),
              notes: notes.trim(),
              date: nowISO(),
              type,
              specialite,
              structure: Number(structure),
            });
            setDx("");
            setMotif("");
            setNotes("");
            onDone();
          } catch (e: any) {
            appAlert("Erreur", e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

function WriteOrdo({
  patientId,
  patientName,
  dark,
  colors,
  onDone,
}: {
  patientId: number;
  patientName?: string;
  dark: boolean;
  colors: any;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<MedLine[]>([emptyMedLine()]);
  const [busy, setBusy] = useState(false);

  const close = () => setOpen(false);

  const patchLine = (i: number, patch: Partial<MedLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    const medicaments = lines.filter((l) => l.nom.trim());
    if (!medicaments.length) {
      appAlert("Médicament", "Ajoutez au moins un médicament.");
      return;
    }
    setBusy(true);
    try {
      await api.createOrdonnance({
        patient: patientId,
        date: nowDateISO(),
        medicaments: medicaments.map((m) => ({
          nom: m.nom.trim(),
          dosage: m.dosage.trim(),
          forme: m.forme,
          quantite: m.quantite,
          unites_par_prise: m.unites_par_prise,
          frequence_par_jour: m.frequence_par_jour,
          duree_jours: Number(m.duree_jours) || 3,
          moment: m.moment,
          instructions: m.instructions,
          frequence:
            m.unites_par_prise && m.frequence_par_jour
              ? `${m.unites_par_prise} × ${m.frequence_par_jour}`
              : "",
        })),
      });
      setLines([emptyMedLine()]);
      close();
      onDone();
      appAlert("OK", "Ordonnance créée.");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  };

  const field = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    backgroundColor: dark ? colors.bg : colors.white,
  } as const;

  return (
    <>
      <Button
        title="Nouvelle ordonnance"
        icon="create-outline"
        color={brandNavy}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
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
            onPress={close}
          />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "88%",
              borderWidth: 1,
              borderColor: colors.border,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
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
                name="medical-outline"
                color={C.teal}
                bg={dark ? "#1C2A2E" : C.lightTeal}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>
                  Nouvelle ordonnance
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  Pour {patientName || "ce patient"}
                </Text>
              </View>
              <PressScale onPress={close} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </PressScale>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {lines.map((m, i) => (
                <View key={i} style={{ gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Médicament {i + 1}</Text>
                  <TextInput
                    value={m.nom}
                    onChangeText={(t) => patchLine(i, { nom: t })}
                    placeholder="Nom (ex. PARA)"
                    placeholderTextColor={colors.muted}
                    style={field}
                  />
                  <TextInput
                    value={m.dosage}
                    onChangeText={(t) => patchLine(i, { dosage: t })}
                    placeholder="Dosage (ex. 1000 mg)"
                    placeholderTextColor={colors.muted}
                    style={field}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {MEDICAMENT_FORMES.map((f) => (
                      <Pressable
                        key={f}
                        onPress={() => patchLine(i, { forme: f })}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: m.forme === f ? C.teal : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.text }}>{f}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    value={m.quantite}
                    onChangeText={(t) => patchLine(i, { quantite: t })}
                    placeholder="Quantité (ex. 1 boîte)"
                    placeholderTextColor={colors.muted}
                    style={field}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={m.unites_par_prise}
                      onChangeText={(t) => patchLine(i, { unites_par_prise: t })}
                      placeholder="Unité/prise"
                      placeholderTextColor={colors.muted}
                      style={{ ...field, flex: 1 }}
                    />
                    <TextInput
                      value={m.frequence_par_jour}
                      onChangeText={(t) => patchLine(i, { frequence_par_jour: t })}
                      placeholder="× / jour"
                      placeholderTextColor={colors.muted}
                      style={{ ...field, flex: 1 }}
                    />
                    <TextInput
                      value={String(m.duree_jours)}
                      onChangeText={(t) => patchLine(i, { duree_jours: Number(t.replace(/\D/g, "")) || "" })}
                      keyboardType="number-pad"
                      placeholder="Jours"
                      placeholderTextColor={colors.muted}
                      style={{ ...field, width: 72 }}
                    />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {MEDICAMENT_MOMENTS.map((mo) => (
                      <Pressable
                        key={mo.value || "none"}
                        onPress={() => patchLine(i, { moment: mo.value })}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: m.moment === mo.value ? C.teal : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.text }}>{mo.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    value={m.instructions}
                    onChangeText={(t) => patchLine(i, { instructions: t })}
                    placeholder="Instructions complémentaires (optionnel)"
                    placeholderTextColor={colors.muted}
                    style={field}
                  />
                  {m.nom ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{summarizeMed(m)}</Text>
                  ) : null}
                </View>
              ))}
              <Button
                title="+ Ajouter un médicament"
                outline
                color={C.teal}
                onPress={() => setLines((prev) => [...prev, emptyMedLine()])}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Annuler"
                    outline
                    color={colors.muted}
                    onPress={close}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Créer l'ordonnance"
                    icon="checkmark-circle-outline"
                    loading={busy}
                    color={brandNavy}
                    onPress={submit}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function WriteBon({
  patientId,
  patientName,
  dark,
  colors,
  onDone,
}: {
  patientId: number;
  patientName?: string;
  dark: boolean;
  colors: any;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<{ code?: string; label?: string; nom?: string; categorie?: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [autreExamen, setAutreExamen] = useState("");
  const [motif, setMotif] = useState("");
  const [observations, setObservations] = useState("");
  const [labo, setLabo] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => setOpen(false);

  const labelOf = (c: { code?: string; label?: string; nom?: string }) =>
    c.label || c.nom || c.code || "";

  const openForm = async () => {
    setOpen(true);
    try {
      const d = await api.examCatalog();
      const list = Array.isArray(d) ? d : (d as any)?.results || [];
      setCatalog(Array.isArray(list) ? list : []);
    } catch {
      setCatalog([]);
    }
  };

  const submit = async () => {
    if (!picked.length) {
      appAlert("Examens", "Sélectionnez au moins un examen.");
      return;
    }
    if (picked.includes("autre") && !autreExamen.trim()) {
      appAlert("Examens", "Précisez le type d'examen (Autre).");
      return;
    }
    setBusy(true);
    try {
      const lignes = picked.map((code) => {
        if (code === "autre") {
          return {
            code: "autre",
            type_examen: autreExamen.trim(),
            categorie: "autres",
          };
        }
        const item = catalog.find((c) => (c.code || labelOf(c)) === code);
        return {
          code: item?.code || "",
          type_examen: labelOf(item || { nom: code }),
          categorie: item?.categorie || "analyses",
        };
      });
      await api.createExamOrder({
        patient: patientId,
        motif: motif.trim(),
        observations: observations.trim(),
        laboratoire_nom: labo.trim(),
        lignes,
      });
      setPicked([]);
      setAutreExamen("");
      setMotif("");
      setObservations("");
      setLabo("");
      close();
      onDone();
      appAlert("OK", "Bon d'examen prescrit.");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        title="Prescrire un examen"
        icon="flask-outline"
        color={C.teal}
        onPress={() => void openForm()}
      />
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
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
            onPress={close}
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
                Prescrire un examen
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Pour {patientName || "ce patient"}
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 32 }}>
              {(catalog.length
                ? catalog
                : [
                    { code: "nfs", label: "NFS" },
                    { code: "crp", label: "CRP" },
                    { code: "glycemie", label: "Glycémie" },
                    { code: "autre", label: "Autre examen", categorie: "autres" },
                  ]
              ).map((c) => {
                  const key = c.code || labelOf(c);
                  const on = picked.includes(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() =>
                        setPicked((prev) =>
                          on ? prev.filter((x) => x !== key) : [...prev, key]
                        )
                      }
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: on ? C.teal : colors.border,
                        backgroundColor: on ? (dark ? "#1C2A2E" : C.lightTeal) : colors.white,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{labelOf(c)}</Text>
                    </Pressable>
                  );
                }
              )}
              {picked.includes("autre") ? (
                <TextInput
                  value={autreExamen}
                  onChangeText={setAutreExamen}
                  placeholder="Préciser l'examen (saisie libre)"
                  placeholderTextColor={colors.muted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                  }}
                />
              ) : null}
              <TextInput
                value={motif}
                onChangeText={setMotif}
                placeholder="Motif / indication"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.text,
                }}
              />
              <TextInput
                value={labo}
                onChangeText={setLabo}
                placeholder="Laboratoire destinataire"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.text,
                }}
              />
              <TextInput
                value={observations}
                onChangeText={setObservations}
                placeholder="Observations (optionnel)"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  minHeight: 64,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.text,
                  textAlignVertical: "top",
                }}
              />
              <Button title="Valider le bon" loading={busy} color={C.teal} onPress={submit} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function WriteExamen({
  patientId,
  patientName,
  dark,
  colors,
  onDone,
}: {
  patientId: number;
  patientName?: string;
  dark: boolean;
  colors: any;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [categorie, setCategorie] = useState<"analyses" | "imagerie" | "autres">("analyses");
  const [statut, setStatut] = useState<"normal" | "eleve" | "critique">("normal");
  const [resultat, setResultat] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => setOpen(false);

  const submit = async () => {
    if (!type.trim()) {
      appAlert("Examen", "Indiquez le type d'examen.");
      return;
    }
    setBusy(true);
    try {
      await api.createExamen({
        patient: patientId,
        type_examen: type.trim(),
        date: new Date().toISOString().slice(0, 10),
        categorie,
        statut,
        resultat_texte: resultat.trim() || "Résultat saisi",
      });
      setType("");
      setResultat("");
      setCategorie("analyses");
      setStatut("normal");
      close();
      onDone();
      appAlert("OK", "Examen enregistré.");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        title="Nouvel examen"
        icon="flask-outline"
        color={C.teal}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
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
            onPress={close}
          />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "88%",
              borderWidth: 1,
              borderColor: colors.border,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
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
                  Pour {patientName || "ce patient"}
                </Text>
              </View>
              <PressScale onPress={close} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </PressScale>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                Type d'examen
              </Text>
              <TextInput
                value={type}
                onChangeText={setType}
                placeholder="NFS, CRP, radio…"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.text,
                  backgroundColor: dark ? colors.bg : colors.white,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Catégorie</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(["analyses", "imagerie", "autres"] as const).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategorie(c)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: categorie === c ? C.teal : colors.border,
                      backgroundColor: categorie === c ? (dark ? "#1C2A2E" : C.lightTeal) : colors.white,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Statut</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(["normal", "eleve", "critique"] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStatut(s)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: statut === s ? C.teal : colors.border,
                      backgroundColor: statut === s ? (dark ? "#1C2A2E" : C.lightTeal) : colors.white,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>
                      {s === "eleve" ? "Élevé" : s}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Résultat</Text>
              <TextInput
                value={resultat}
                onChangeText={setResultat}
                placeholder="Texte du résultat…"
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Annuler"
                    outline
                    color={colors.muted}
                    onPress={close}
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
    </>
  );
}
