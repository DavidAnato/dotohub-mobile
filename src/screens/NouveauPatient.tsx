import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { appAlert } from "../components/AppDialog";
import { api } from "../api";
import { C, darkC } from "../theme";
import { nationalDigits, toE164Bj } from "../phone";
import { BrandBackground, hapticSuccess, ScreenEnter } from "../motion";
import { Button, Field, Header, PhoneField } from "../ui";
import { takePendingOcr, type IdOcr } from "../pendingOcr";
import { useAppStore } from "../store/appStore";

const NPI_RE = /^\d{10}$/;

type FormState = {
  npi: string;
  nom: string;
  prenom: string;
  telephone: string;
  date_naissance: string;
  lieu_naissance: string;
  sexe: "" | "M" | "F";
  nom_pere: string;
  nom_mere: string;
  contact_urgence_nom: string;
  contact_urgence_lien: string;
  tel_urgence: string;
  adresse_commune: string;
  adresse_quartier: string;
  allergies: string;
};

const EMPTY: FormState = {
  npi: "",
  nom: "",
  prenom: "",
  telephone: "",
  date_naissance: "",
  lieu_naissance: "",
  sexe: "",
  nom_pere: "",
  nom_mere: "",
  contact_urgence_nom: "",
  contact_urgence_lien: "",
  tel_urgence: "",
  adresse_commune: "",
  adresse_quartier: "",
  allergies: "",
};

function applyOcr(prev: FormState, ocr: IdOcr): FormState {
  const quartier = (ocr.address_quartier || ocr.address_arrondissement || "").trim();
  return {
    ...prev,
    npi: String(ocr.npi || prev.npi).replace(/\D/g, "").slice(0, 10),
    nom: (ocr.last_name || prev.nom || "").trim(),
    prenom: (ocr.first_name || prev.prenom || "").trim(),
    date_naissance: String(ocr.birth_date || prev.date_naissance || "").slice(0, 10),
    lieu_naissance: (ocr.birth_place || prev.lieu_naissance || "").trim(),
    telephone: ocr.phone || prev.telephone,
    adresse_commune: (ocr.address_commune || prev.adresse_commune || "").trim(),
    adresse_quartier: quartier || prev.adresse_quartier,
    nom_pere: (ocr.father_name || prev.nom_pere || "").trim(),
    nom_mere: (ocr.mother_name || prev.nom_mere || "").trim(),
  };
}

export default function NouveauPatient({
  dark = false,
  onBack,
  onSaved,
  patientId,
}: {
  dark?: boolean;
  onBack: () => void;
  onSaved?: (id: number) => void;
  patientId?: number;
}) {
  const colors = dark ? darkC : C;
  const isEdit = !!patientId;
  const user = useAppStore((s) => s.user);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(isEdit ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [savedId, setSavedId] = useState<number | null>(patientId ?? null);

  const structureNom =
    user?.structures?.find((s) => s.id && s.id === user.structure_principale)?.nom ||
    user?.nom_etablissement ||
    "Votre établissement";

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const consumeOcr = useCallback(() => {
    const ocr = takePendingOcr();
    if (!ocr) return;
    setForm((f) => applyOcr(f, ocr));
    setStep(1);
    setError("");
  }, []);

  useFocusEffect(
    useCallback(() => {
      consumeOcr();
    }, [consumeOcr])
  );

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const p = await api.patient(patientId);
        if (cancelled) return;
        const allergies = Array.isArray(p?.dossier?.allergies)
          ? p.dossier.allergies.join(", ")
          : Array.isArray(p?.allergies)
            ? p.allergies.join(", ")
            : "";
        setForm({
          npi: String(p.npi || "").replace(/\D/g, "").slice(0, 10),
          nom: p.nom || "",
          prenom: p.prenom || "",
          telephone: p.telephone || "",
          date_naissance: p.date_naissance || "",
          lieu_naissance: p.lieu_naissance || "",
          sexe: p.sexe === "M" || p.sexe === "F" ? p.sexe : "",
          nom_pere: p.nom_pere || "",
          nom_mere: p.nom_mere || "",
          contact_urgence_nom: p.contact_urgence_nom || "",
          contact_urgence_lien: p.contact_urgence_lien || "",
          tel_urgence: p.tel_urgence || "",
          adresse_commune: p.adresse_commune || "",
          adresse_quartier: p.adresse_quartier || "",
          allergies,
        });
        setExistingPhoto(p.photo_url || "");
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

  const scanPiece = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      appAlert("Caméra", "Autorisez la caméra pour photographier la CIP ou la carte CEDEAO.");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (shot.canceled || !shot.assets?.[0]) return;
    const asset = shot.assets[0];
    setBusy(true);
    setError("");
    try {
      const data = await api.ocrIdCard({
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: asset.fileName || "piece.jpg",
      });
      setForm((f) => applyOcr(f, data));
      setStep(1);
      hapticSuccess();
    } catch (e: any) {
      const msg = e?.message || "Lecture impossible.";
      setError(msg);
      appAlert("Pièce", msg);
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      appAlert("Caméra", "Autorisez la caméra pour la photo d'identité.");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (shot.canceled || !shot.assets?.[0]) return;
    const asset = shot.assets[0];
    setPhoto({ uri: asset.uri, type: asset.mimeType || "image/jpeg", name: asset.fileName || "photo.jpg" });
  };

  const validateIdentity = (): string | null => {
    if (!NPI_RE.test(form.npi.trim())) return "Le NPI doit contenir exactement 10 chiffres.";
    if (!form.nom.trim()) return "Le nom est requis.";
    if (!form.prenom.trim()) return "Le prénom est requis.";
    if (nationalDigits(form.telephone).length > 0 && nationalDigits(form.telephone).length < 8) {
      return "Téléphone invalide (numéro local Bénin).";
    }
    if (!form.date_naissance.trim()) return "La date de naissance est requise (AAAA-MM-JJ).";
    return null;
  };

  const next = () => {
    setError("");
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      const err = validateIdentity();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!photo && !existingPhoto) {
        setError("Ajoutez la photo d'identité (minimum 200×200).");
        return;
      }
      setStep(3);
    }
  };

  const save = async () => {
    setError("");
    const err = validateIdentity();
    if (err) {
      setError(err);
      setStep(1);
      return;
    }
    const urg = nationalDigits(form.tel_urgence);
    if (form.tel_urgence && urg.length > 0 && urg.length < 8) {
      setError("Téléphone d'urgence invalide.");
      return;
    }
    if (!photo && !existingPhoto) {
      setError("La photo d'identité est nécessaire pour la DotoCard.");
      setStep(2);
      return;
    }
    const allergies = form.allergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      npi: form.npi.trim(),
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      telephone: nationalDigits(form.telephone).length >= 8 ? toE164Bj(form.telephone) : "",
      date_naissance: form.date_naissance.trim(),
      lieu_naissance: form.lieu_naissance.trim(),
      sexe: form.sexe || "",
      nom_pere: form.nom_pere.trim(),
      nom_mere: form.nom_mere.trim(),
      adresse_commune: form.adresse_commune.trim(),
      adresse_quartier: form.adresse_quartier.trim(),
      contact_urgence_nom: form.contact_urgence_nom.trim(),
      contact_urgence_lien: form.contact_urgence_lien.trim(),
      tel_urgence: form.tel_urgence ? toE164Bj(form.tel_urgence) : "",
      allergies,
    };
    setBusy(true);
    try {
      const saved = savedId ? await api.updatePatient(savedId, body) : await api.createPatient(body);
      const id = Number(saved.id);
      setSavedId(id);
      if (photo && id) await api.uploadPatientPhoto(id, photo);
      hapticSuccess();
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

  const titles = ["Pièce", "Identité", "Photo", "Contact"];

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title={isEdit ? "Modifier patient" : "Nouveau patient"}
          subtitle={`${step + 1}/4 · ${titles[step]}`}
          onBack={onBack}
        />
        {loading ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.muted }}>Chargement…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {step === 0 ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>Scanner la pièce</Text>
                <Text style={{ color: colors.muted, lineHeight: 20 }}>
                  Photographiez la CIP ou la carte CEDEAO. La reconnaissance part sur le hub web du même compte et préremplit ce formulaire.
                </Text>
                <Button
                  title={busy ? "Lecture…" : "Photographier la pièce"}
                  icon="camera-outline"
                  onPress={() => void scanPiece()}
                  loading={busy}
                  color={C.teal}
                />
                <Button title="Saisir à la main" outline color={colors.muted} onPress={next} disabled={busy} />
              </View>
            ) : null}

            {step === 1 ? (
              <View>
                <Field
                  label="NPI (10 chiffres)"
                  value={form.npi}
                  onChangeText={(t) => {
                    if (isEdit) return;
                    set("npi")(t.replace(/\D/g, "").slice(0, 10));
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                  colors={colors}
                />
                <Field label="Nom" value={form.nom} onChangeText={set("nom")} colors={colors} />
                <Field label="Prénom" value={form.prenom} onChangeText={set("prenom")} colors={colors} />
                <Field
                  label="Date de naissance (AAAA-MM-JJ)"
                  value={form.date_naissance}
                  onChangeText={set("date_naissance")}
                  colors={colors}
                />
                <Field label="Lieu de naissance" value={form.lieu_naissance} onChangeText={set("lieu_naissance")} colors={colors} />
                <PhoneField label="Téléphone" value={form.telephone} onChangeText={set("telephone")} colors={colors} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>Sexe</Text>
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
                <Field label="Nom du père" value={form.nom_pere} onChangeText={set("nom_pere")} colors={colors} />
                <Field label="Nom de la mère" value={form.nom_mere} onChangeText={set("nom_mere")} colors={colors} />
                <Field label="Commune" value={form.adresse_commune} onChangeText={set("adresse_commune")} colors={colors} />
                <Field label="Quartier" value={form.adresse_quartier} onChangeText={set("adresse_quartier")} colors={colors} />
              </View>
            ) : null}

            {step === 2 ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>Photo d'identité</Text>
                <Text style={{ color: colors.muted }}>Visage centré, au moins 200×200. Ce n'est pas la photo de la pièce.</Text>
                {photo?.uri || existingPhoto ? (
                  <Image
                    source={{ uri: photo?.uri || existingPhoto }}
                    style={{ width: 120, height: 120, borderRadius: 16 }}
                  />
                ) : null}
                <Button title={photo || existingPhoto ? "Reprendre la photo" : "Prendre la photo"} icon="camera-outline" onPress={() => void pickPhoto()} color={C.teal} />
              </View>
            ) : null}

            {step === 3 ? (
              <View>
                <Text style={{ color: colors.muted, fontWeight: "700", marginBottom: 8 }}>Contact d'urgence</Text>
                <Field label="Nom du contact" value={form.contact_urgence_nom} onChangeText={set("contact_urgence_nom")} colors={colors} />
                <Field label="Lien" value={form.contact_urgence_lien} onChangeText={set("contact_urgence_lien")} colors={colors} />
                <PhoneField label="Téléphone d'urgence" value={form.tel_urgence} onChangeText={set("tel_urgence")} colors={colors} />
                <Field
                  label="Allergies (séparées par des virgules)"
                  value={form.allergies}
                  onChangeText={set("allergies")}
                  colors={colors}
                />
                <Text style={{ color: colors.text, marginTop: 8 }}>
                  Hôpital mère : <Text style={{ fontWeight: "800" }}>{structureNom}</Text>
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 12 }}>
                  C'est l'établissement de ce compte. Il pourra émettre la DotoCard.
                </Text>
              </View>
            ) : null}

            {error ? <Text style={{ color: colors.amber, fontWeight: "700", marginVertical: 12 }}>{error}</Text> : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={step === 0 ? "Annuler" : "Retour"}
                  outline
                  color={colors.muted}
                  onPress={() => (step === 0 ? onBack() : setStep((s) => s - 1))}
                  disabled={busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                {step < 3 ? (
                  <Button title="Continuer" onPress={next} color={C.teal} disabled={busy} />
                ) : (
                  <Button
                    title={busy ? "Enregistrement…" : "Enregistrer"}
                    onPress={() => void save()}
                    loading={busy}
                    color={C.teal}
                    disabled={busy}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </ScreenEnter>
    </BrandBackground>
  );
}
