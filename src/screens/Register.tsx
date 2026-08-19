import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, Header, PhoneField } from "../ui";
import { C, darkC, ProUser } from "../theme";
import { api } from "../api";
import { PRO_ROLES, TYPE_EXERCICE } from "../constants";
import { appAlert } from "../components/AppDialog";
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
  const { scrollBottom } = useScreenInsets();
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
  const [busy, setBusy] = useState(false);
  const independant = kind === "independant";

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
      appAlert("Inscription", "Désignez l'établissement principal.");
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

  const grad = dark
    ? ([colors.bg, "#162032", colors.white] as const)
    : (["#E8F2F5", "#F1F5F9", "#FFFFFF"] as const);

  return (
    <LinearGradient colors={[...grad]} style={{ flex: 1 }}>
      <ScreenEnter>
        <Header
          title="Inscription professionnelle"
          subtitle={step === 1 ? "Identité et identifiants" : "Type, établissement et autorisations"}
          onBack={step === 1 ? onBack : () => setStep(1)}
        />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: scrollBottom, gap: 8 }}>
          {step === 1 ? (
            <>
              <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 20 }}>
                Créez votre compte professionnel. Un administrateur validera ensuite l'affiliation.
              </Text>
              <Field label="Nom" value={lastName} onChangeText={setLastName} colors={colors} />
              <Field label="Prénom" value={firstName} onChangeText={setFirstName} colors={colors} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12, letterSpacing: 0.4, marginBottom: 6 }}>
                RÔLE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {PRO_ROLES.map((r) => (
                  <Pressable
                    key={r.v}
                    onPress={() => setRole(r.v)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: role === r.v ? C.teal : colors.white,
                      borderWidth: 1,
                      borderColor: role === r.v ? C.teal : colors.border,
                    }}
                  >
                    <Text style={{ color: role === r.v ? "#fff" : colors.text, fontWeight: "700", fontSize: 12 }}>
                      {r.l}
                    </Text>
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
              <Button title="Continuer" color={C.teal} onPress={goStep2} />
            </>
          ) : (
            <>
              <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 20 }}>
                Renseignez votre type d'exercice. Un professionnel peut rattacher plusieurs établissements.
              </Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12, letterSpacing: 0.4, marginBottom: 6 }}>
                TYPE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {TYPE_EXERCICE.map((k) => (
                  <Pressable
                    key={k.v}
                    onPress={() => setKind(k.v)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: kind === k.v ? C.teal : colors.white,
                      borderWidth: 1,
                      borderColor: kind === k.v ? C.teal : colors.border,
                    }}
                  >
                    <Text style={{ color: kind === k.v ? "#fff" : colors.text, fontWeight: "700", fontSize: 12 }}>
                      {k.l}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Ville d'exercice" value={ville} onChangeText={setVille} colors={colors} placeholder="Cotonou" />
              <Field
                label={independant ? "Nom du cabinet / exercice" : "Nom de l'établissement"}
                value={nomLibre}
                onChangeText={setNomLibre}
                colors={colors}
                placeholder="Clinique, pharmacie ou cabinet"
              />
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
              <Button title="Créer le compte" loading={busy} color={C.teal} onPress={() => void submit()} />
            </>
          )}
        </ScrollView>
      </ScreenEnter>
    </LinearGradient>
  );
}
