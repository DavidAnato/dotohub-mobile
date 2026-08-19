import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthScreenHeader, Button, Field, PhoneField } from "../ui";
import { C, darkC, ProUser, accent } from "../theme";
import { api } from "../api";
import { PRO_ROLES, TYPE_EXERCICE, typeExerciceHint } from "../constants";
import { appAlert } from "../components/AppDialog";
import { HospitalPicker } from "../components/HospitalPicker";
import { ScreenEnter } from "../motion";
import { useScreenInsets } from "../safeArea";

export default function Register({
  onDone,
  onBack,
  dark = false,
}: {
  onDone: (u: ProUser) => void;
  onBack: () => void;
  dark?: boolean;
}) {
  const colors = dark ? darkC : C;
  const { scrollBottom, bottom } = useScreenInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState("medecin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [kind, setKind] = useState("etablissement_sante");
  const [ville, setVille] = useState("");
  const [nomLibre, setNomLibre] = useState("");
  const [autorisation, setAutorisation] = useState("");
  const [ordre, setOrdre] = useState("");
  const [emailPro, setEmailPro] = useState("");
  const [lignePro, setLignePro] = useState("");
  const [hospitals, setHospitals] = useState<{ id: number; nom: string; commune?: string }[]>([]);
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [principalId, setPrincipalId] = useState<number | "">("");
  const [horsCatalogue, setHorsCatalogue] = useState(false);
  const [busy, setBusy] = useState(false);
  const independant = kind === "independant";
  const showNomLibre = independant || horsCatalogue || !hospitals.length;

  useEffect(() => {
    api
      .hospitals()
      .then((r: any) => setHospitals(r.structures || []))
      .catch(() => setHospitals([]));
  }, []);

  const goStep2 = () => {
    if (!lastName.trim() || !firstName.trim()) {
      appAlert("Inscription", "Nom et prénom requis.");
      return;
    }
    if (!username.trim()) {
      appAlert("Inscription", "Identifiant ou email de connexion requis.");
      return;
    }
    if (password.length < 8) {
      appAlert("Inscription", "Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== password2) {
      appAlert("Inscription", "Les mots de passe ne correspondent pas.");
      return;
    }
    setStep(2);
  };

  const chooseKind = (next: string) => {
    setKind(next);
    if (next === "independant") {
      setPickedIds([]);
      setPrincipalId("");
      setHorsCatalogue(false);
    }
  };

  const submit = async () => {
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
        username: username.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: emailPro.trim(),
        role,
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
      const user = await api.register(payload);
      appAlert(
        "Compte créé",
        "Votre affiliation est en attente de validation admin. Configurez ensuite votre PIN à 4 chiffres."
      );
      onDone(user);
    } catch (e: any) {
      appAlert("Erreur", e.message || "Inscription impossible.");
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = PRO_ROLES.find((r) => r.v === role)?.l || role;
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

  const grad = dark
    ? ([colors.bg, "#121212", colors.white] as const)
    : (["#F4FBFC", "#F7FAFB", "#FFFFFF"] as const);

  const chip = (on: boolean) => ({
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: on ? "rgba(43,179,188,0.12)" : "transparent",
    borderWidth: 1,
    borderColor: on ? accent : colors.border,
  });

  const group = {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: dark ? colors.white : "#F7FAFB",
  };

  return (
    <LinearGradient colors={[...grad]} style={{ flex: 1 }}>
      <ScreenEnter>
        <AuthScreenHeader
          colors={colors}
          title={step === 1 ? "Votre identité" : "Votre exercice"}
          subtitle={
            step === 1
              ? "Nom, rôle et identifiants de compte."
              : "D'abord le type, ensuite seulement les champs utiles."
          }
          onBack={step === 1 ? onBack : () => setStep(1)}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: step === 2 ? 16 : scrollBottom,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: accent }} />
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 99,
                backgroundColor: step === 2 ? accent : colors.border,
              }}
            />
          </View>
          {step === 1 ? (
            <>
              <Field label="Nom" value={lastName} onChangeText={setLastName} colors={colors} />
              <Field label="Prénom" value={firstName} onChangeText={setFirstName} colors={colors} />
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, marginBottom: 8 }}>
                Rôle
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {PRO_ROLES.map((r) => (
                  <Pressable key={r.v} onPress={() => setRole(r.v)} style={chip(role === r.v)}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{r.l}</Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label="Identifiant / email"
                value={username}
                onChangeText={setUsername}
                colors={colors}
                placeholder="awa.kpo"
              />
              <Field
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                colors={colors}
                placeholder="8 caractères minimum"
                secureTextEntry
              />
              <Field
                label="Confirmer le mot de passe"
                value={password2}
                onChangeText={setPassword2}
                colors={colors}
                secureTextEntry
              />
              <Button title="Continuer" color={C.navy === colors.navy ? C.navy : accent} onPress={goStep2} />
            </>
          ) : (
            <>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, marginBottom: 8 }}>
                Type d'exercice
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {TYPE_EXERCICE.map((k) => (
                  <Pressable key={k.v} onPress={() => chooseKind(k.v)} style={chip(kind === k.v)}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{k.l}</Text>
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
                <Field
                  label="N° autorisation"
                  value={autorisation}
                  onChangeText={setAutorisation}
                  colors={colors}
                  placeholder="890094/BEN"
                />
                <Field
                  label="N° Ordre National"
                  value={ordre}
                  onChangeText={setOrdre}
                  colors={colors}
                  placeholder="12345/ON/DEPT/2023"
                />
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
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                  {firstName} {lastName} · {roleLabel}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{kindLabel}</Text>
                <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>
                  {ville.trim() ? `${recapLieu} · ${ville.trim()}` : recapLieu}
                </Text>
                {!independant && principalNom ? (
                  <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>Principal : {principalNom}</Text>
                ) : null}
                {!recapReady ? (
                  <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
                    Complétez le lieu d'exercice pour créer le compte.
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
        {step === 2 ? (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: Math.max(bottom, 12),
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: dark ? colors.bg : "#FFFFFF",
            }}
          >
            <Button title="Retour" outline color={colors.navy} onPress={() => setStep(1)} compact style={{ minWidth: 96 }} />
            <Button
              title="Créer le compte"
              loading={busy}
              color={dark ? accent : C.navy}
              onPress={() => void submit()}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
      </ScreenEnter>
    </LinearGradient>
  );
}
