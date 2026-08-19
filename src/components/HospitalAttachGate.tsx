import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { C, darkC, accent, tealInk } from "../theme";
import { api } from "../api";
import { AuthScreenHeader, Button, Field, PhoneField } from "../ui";
import { appAlert } from "./AppDialog";
import { HospitalPicker } from "./HospitalPicker";
import { useScreenInsets } from "../safeArea";
import { TYPE_EXERCICE, typeExerciceHint } from "../constants";

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
  const { bottom } = useScreenInsets();
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
  const [horsCatalogue, setHorsCatalogue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    api
      .hospitals()
      .then((r: any) => setHospitals(r.structures || []))
      .catch(() => setHospitals([]));
  }, [visible]);

  const independant = kind === "independant";
  const showNomLibre = independant || horsCatalogue || !hospitals.length;

  const chooseKind = (next: string) => {
    setKind(next);
    if (next === "independant") {
      setPickedIds([]);
      setPrincipalId("");
      setHorsCatalogue(false);
    }
  };

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
      appAlert("Inscription", "Désignez l'établissement principal (étoile).");
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
        structure_ids: independant ? [] : pickedIds,
        structure_principale: independant ? null : principalId || null,
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

  const kindLabel = TYPE_EXERCICE.find((k) => k.v === kind)?.l || kind;
  const principalNom = hospitals.find((h) => h.id === principalId)?.nom;
  const pickedNoms = hospitals.filter((h) => pickedIds.includes(h.id)).map((h) => h.nom);
  const recapLieu = independant
    ? nomLibre.trim() || "Nom du cabinet à renseigner"
    : pickedNoms.length
      ? pickedNoms.length > 2
        ? `${pickedNoms[0]} + ${pickedNoms.length - 1} autres`
        : pickedNoms.join(", ")
      : nomLibre.trim() || "Aucun établissement choisi";
  const recapReady = useMemo(
    () =>
      independant ? Boolean(nomLibre.trim()) : Boolean(pickedIds.length || nomLibre.trim()),
    [independant, nomLibre, pickedIds.length]
  );

  const group = {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        <AuthScreenHeader
          colors={colors}
          title="Votre exercice"
          subtitle="D'abord le type, ensuite seulement les champs utiles."
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, marginBottom: 8 }}>
            Type d'exercice
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {TYPE_EXERCICE.map((k) => (
              <Pressable
                key={k.v}
                onPress={() => chooseKind(k.v)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: kind === k.v ? accent : "transparent",
                  borderWidth: 1,
                  borderColor: kind === k.v ? accent : colors.border,
                }}
              >
                <Text
                  style={{
                    color: kind === k.v ? tealInk : colors.text,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {k.l}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
            {typeExerciceHint(kind)}
          </Text>

          <View style={group}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "800",
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Où j'exerce
            </Text>
            <Field label="Ville d'exercice" value={ville} onChangeText={setVille} colors={colors} placeholder="Cotonou" />
            {independant ? (
              <Field
                label="Nom du cabinet / exercice"
                value={nomLibre}
                onChangeText={setNomLibre}
                colors={colors}
                placeholder="Cabinet Dr. Kpo"
              />
            ) : (
              <>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, marginBottom: 8 }}>
                  Établissements du catalogue
                </Text>
                <HospitalPicker
                  hospitals={hospitals}
                  pickedIds={pickedIds}
                  principalId={principalId}
                  onChangePicked={setPickedIds}
                  onChangePrincipal={setPrincipalId}
                  colors={colors}
                />
                {hospitals.length ? (
                  <Pressable onPress={() => setHorsCatalogue((v) => !v)} style={{ marginBottom: 12 }}>
                    <Text style={{ color: accent, fontWeight: "700", fontSize: 13 }}>
                      {horsCatalogue
                        ? "Masquer le nom hors catalogue"
                        : "Mon établissement n'est pas dans la liste"}
                    </Text>
                  </Pressable>
                ) : null}
                {showNomLibre ? (
                  <Field
                    label="Nom hors catalogue"
                    value={nomLibre}
                    onChangeText={setNomLibre}
                    colors={colors}
                    placeholder="Clinique, pharmacie ou laboratoire"
                  />
                ) : null}
              </>
            )}
          </View>

          <View style={group}>
            <Text
              style={{
                color: colors.muted,
                fontWeight: "800",
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Identifiants professionnels
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 10 }}>
              Facultatif. Utile pour la validation admin.
            </Text>
            <Field label="N° autorisation" value={autorisation} onChangeText={setAutorisation} colors={colors} />
            <Field label="N° Ordre National" value={ordre} onChangeText={setOrdre} colors={colors} />
            <Field
              label="Email professionnel"
              value={emailPro}
              onChangeText={setEmailPro}
              colors={colors}
              keyboardType="email-address"
            />
            <PhoneField label="Ligne professionnelle +229" value={lignePro} onChangeText={setLignePro} colors={colors} />
          </View>

          <View
            style={{
              marginBottom: 8,
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontWeight: "800",
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Récapitulatif
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{kindLabel}</Text>
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>
              {ville.trim() ? `${recapLieu} · ${ville.trim()}` : recapLieu}
            </Text>
            {!independant && principalNom ? (
              <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>Principal : {principalNom}</Text>
            ) : null}
            {!recapReady ? (
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
                Complétez le lieu d'exercice pour valider.
              </Text>
            ) : null}
          </View>
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(bottom, 12),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.white,
          }}
        >
          <Button title="Valider" loading={busy} color={dark ? accent : C.navy} onPress={() => void save()} />
        </View>
      </View>
    </Modal>
  );
}
