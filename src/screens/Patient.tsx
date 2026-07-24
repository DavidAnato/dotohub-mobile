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
import { usePullRefresh } from "../hooks/usePullRefresh";
import { qk } from "../queries/keys";

/** Création RDV : médecins, réceptionniste, admin */
const RDV_WRITE_ROLES = new Set(["medecin", "receptionniste", "admin"]);
const FULL_ACCESS_ROLES = new Set([
  "medecin",
  "infirmier",
  "pharmacien",
  "laborantin",
  "receptionniste",
]);

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
        {patient.urgence ? <UrgenceBanner u={patient.urgence} colors={colors} /> : null}

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
                        {item.diagnostic || "Consultation"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        {item.date ? new Date(item.date).toLocaleDateString("fr-FR") : ""}
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
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {item.statut_label || item.statut}
                      </Text>
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
    </Card>
  );
}

function WriteConsult({
  patientId,
  colors,
  onDone,
}: {
  patientId: number;
  colors: any;
  onDone: () => void;
}) {
  const [dx, setDx] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card colors={colors} style={{ gap: 8 }}>
      <Text style={{ fontWeight: "800", color: colors.text }}>Nouvelle consultation</Text>
      <TextInput
        value={dx}
        onChangeText={setDx}
        placeholder="Diagnostic"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text }}
      />
      <Button
        title="Enregistrer"
        loading={busy}
        color={C.blue}
        onPress={async () => {
          if (!dx.trim()) return;
          setBusy(true);
          try {
            await api.createConsultation({
              patient: patientId,
              diagnostic: dx.trim(),
              date: new Date().toISOString(),
              type: "consultation",
            });
            setDx("");
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
  const [nom, setNom] = useState("");
  const [dosage, setDosage] = useState("1");
  const [frequence, setFrequence] = useState("1x/j");
  const [duree, setDuree] = useState("7");
  const [busy, setBusy] = useState(false);

  const close = () => setOpen(false);

  const submit = async () => {
    if (!nom.trim()) {
      appAlert("Médicament", "Indiquez le nom du médicament.");
      return;
    }
    setBusy(true);
    try {
      await api.createOrdonnance({
        patient: patientId,
        date: new Date().toISOString().slice(0, 10),
        medicaments: [
          {
            nom: nom.trim(),
            dosage: dosage.trim() || "1",
            frequence: frequence.trim() || "1x/j",
            duree_jours: Number(duree) || 7,
          },
        ],
      });
      setNom("");
      setDosage("1");
      setFrequence("1x/j");
      setDuree("7");
      close();
      onDone();
      appAlert("OK", "Ordonnance créée.");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  };

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
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Médicament</Text>
              <TextInput
                value={nom}
                onChangeText={setNom}
                placeholder="Ex. Amlodipine"
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
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Dosage</Text>
              <TextInput
                value={dosage}
                onChangeText={setDosage}
                placeholder="5 mg"
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
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Fréquence</Text>
              <TextInput
                value={frequence}
                onChangeText={setFrequence}
                placeholder="1x/j"
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
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Durée (jours)</Text>
              <TextInput
                value={duree}
                onChangeText={setDuree}
                keyboardType="number-pad"
                placeholder="7"
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
