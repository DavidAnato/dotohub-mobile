import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { appAlert } from "../components/AppDialog";
import { api } from "../api";
import { C, darkC } from "../theme";
import { nationalDigits, toE164Bj } from "../phone";
import {
  BrandBackground,
  hapticSuccess,
  ScreenEnter,
} from "../motion";
import { Button, Field, Header, PhoneField } from "../ui";

const NPI_RE = /^\d{10}$/;

type FormState = {
  npi: string;
  nom: string;
  prenom: string;
  telephone: string;
  date_naissance: string;
  sexe: "" | "M" | "F";
  contact_urgence_nom: string;
  contact_urgence_lien: string;
  tel_urgence: string;
  adresse_commune: string;
  adresse_quartier: string;
};

const EMPTY: FormState = {
  npi: "",
  nom: "",
  prenom: "",
  telephone: "",
  date_naissance: "",
  sexe: "",
  contact_urgence_nom: "",
  contact_urgence_lien: "",
  tel_urgence: "",
  adresse_commune: "",
  adresse_quartier: "",
};

export default function NouveauPatient({
  dark = false,
  onBack,
  onSaved,
  patientId,
}: {
  dark?: boolean;
  onBack: () => void;
  /** Après create/update - typiquement navigate vers Patient. */
  onSaved?: (id: number) => void;
  /** Si fourni : mode édition (PATCH). */
  patientId?: number;
}) {
  const colors = dark ? darkC : C;
  const isEdit = !!patientId;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const p = await api.patient(patientId);
        if (cancelled) return;
        setForm({
          npi: String(p.npi || "")
            .replace(/\D/g, "")
            .slice(0, 10),
          nom: p.nom || "",
          prenom: p.prenom || "",
          telephone: p.telephone || "",
          date_naissance: p.date_naissance || "",
          sexe: p.sexe === "M" || p.sexe === "F" ? p.sexe : "",
          contact_urgence_nom: p.contact_urgence_nom || "",
          contact_urgence_lien: p.contact_urgence_lien || "",
          tel_urgence: p.tel_urgence || "",
          adresse_commune: p.adresse_commune || "",
          adresse_quartier: p.adresse_quartier || "",
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Chargement impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const validate = (): string | null => {
    if (!NPI_RE.test(form.npi.trim())) return "Le NPI doit contenir exactement 10 chiffres.";
    if (!form.nom.trim()) return "Le nom est requis.";
    if (!form.prenom.trim()) return "Le prénom est requis.";
    if (nationalDigits(form.telephone).length < 8) {
      return "Téléphone invalide (numéro local Bénin).";
    }
    if (!form.date_naissance.trim()) return "La date de naissance est requise (AAAA-MM-JJ).";
    const urg = nationalDigits(form.tel_urgence);
    if (form.tel_urgence && urg.length > 0 && urg.length < 8) {
      return "Téléphone d'urgence invalide.";
    }
    return null;
  };

  const save = async () => {
    setError("");
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const body: Record<string, unknown> = {
      npi: form.npi.trim(),
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      telephone: toE164Bj(form.telephone),
      date_naissance: form.date_naissance.trim(),
      sexe: form.sexe || "",
      adresse_commune: form.adresse_commune.trim(),
      adresse_quartier: form.adresse_quartier.trim(),
      contact_urgence_nom: form.contact_urgence_nom.trim(),
      contact_urgence_lien: form.contact_urgence_lien.trim(),
      tel_urgence: form.tel_urgence ? toE164Bj(form.tel_urgence) : "",
    };
    setBusy(true);
    try {
      const saved = isEdit
        ? await api.updatePatient(patientId!, body)
        : await api.createPatient(body);
      hapticSuccess();
      const id = Number(saved.id);
      if (onSaved && id) onSaved(id);
      else onBack();
    } catch (e: any) {
      const msg = e?.message || "Enregistrement impossible.";
      setError(msg);
      appAlert("Erreur", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title={isEdit ? "Modifier patient" : "Nouveau patient"}
          subtitle="NPI · identité · coordonnées"
          onBack={onBack}
        />
        {loading ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.muted }}>Chargement…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="NPI (10 chiffres)"
              value={form.npi}
              onChangeText={(t) => {
                if (isEdit) return;
                set("npi")(t.replace(/\D/g, "").slice(0, 10));
              }}
              placeholder="1234567890"
              keyboardType="number-pad"
              maxLength={10}
              colors={colors}
            />
            <Field
              label="Nom"
              value={form.nom}
              onChangeText={set("nom")}
              placeholder="Adjovi"
              colors={colors}
            />
            <Field
              label="Prénom"
              value={form.prenom}
              onChangeText={set("prenom")}
              placeholder="Kofi"
              colors={colors}
            />
            <PhoneField
              label="Téléphone"
              value={form.telephone}
              onChangeText={set("telephone")}
              colors={colors}
            />
            <Field
              label="Date de naissance (AAAA-MM-JJ)"
              value={form.date_naissance}
              onChangeText={set("date_naissance")}
              placeholder="1990-05-12"
              keyboardType="numbers-and-punctuation"
              colors={colors}
            />
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>
              Sexe (optionnel)
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {(
                [
                  { v: "", label: "-" },
                  { v: "M", label: "Masculin" },
                  { v: "F", label: "Féminin" },
                ] as const
              ).map((opt) => {
                const active = form.sexe === opt.v;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => set("sexe")(opt.v)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: active ? C.teal : colors.border,
                      backgroundColor: active ? "rgba(20,184,166,0.12)" : colors.white,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: active ? C.teal : colors.text, fontSize: 13 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Commune"
              value={form.adresse_commune}
              onChangeText={set("adresse_commune")}
              placeholder="Cotonou"
              colors={colors}
            />
            <Field
              label="Quartier"
              value={form.adresse_quartier}
              onChangeText={set("adresse_quartier")}
              placeholder="Akpakpa"
              colors={colors}
            />
            <Text style={{ color: colors.muted, fontWeight: "700", marginBottom: 8, marginTop: 4 }}>
              Contact d'urgence (optionnel)
            </Text>
            <Field
              label="Nom du contact"
              value={form.contact_urgence_nom}
              onChangeText={set("contact_urgence_nom")}
              colors={colors}
            />
            <Field
              label="Lien"
              value={form.contact_urgence_lien}
              onChangeText={set("contact_urgence_lien")}
              placeholder="Époux / Parent…"
              colors={colors}
            />
            <PhoneField
              label="Téléphone d'urgence"
              value={form.tel_urgence}
              onChangeText={set("tel_urgence")}
              colors={colors}
            />

            {error ? (
              <Text style={{ color: colors.amber, fontWeight: "700", marginBottom: 12 }}>{error}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Annuler"
                  outline
                  color={colors.muted}
                  onPress={onBack}
                  disabled={busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={busy ? "Enregistrement…" : "Enregistrer"}
                  icon="checkmark-circle-outline"
                  onPress={save}
                  loading={busy}
                  color={C.teal}
                  disabled={busy}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </ScreenEnter>
    </BrandBackground>
  );
}
