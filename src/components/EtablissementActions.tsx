import React, { useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { appAlert } from "./AppDialog";
import { C, darkC } from "../theme";
import { Button, Card, Field } from "../ui";
import { useAppStore } from "../store/appStore";

type Etab = {
  hopital_mere_id?: number | null;
  hopital_mere_nom?: string | null;
  app_activee?: boolean;
  medecin_referent_nom?: string | null;
  peut_emettre_carte?: boolean;
  peut_lancer_transfert?: boolean;
  peut_demander_transfert?: boolean;
  transfert?: { status_label?: string; from_structure_nom?: string; to_structure_nom?: string } | null;
};

export function EtablissementActions({
  patientId,
  etablissement,
  dark,
  onChanged,
}: {
  patientId: number;
  etablissement?: Etab | null;
  dark?: boolean;
  onChanged?: () => void;
}) {
  const etab = etablissement || {};
  const colors = dark ? darkC : C;
  const user = useAppStore((s) => s.user);
  const show =
    etab.hopital_mere_nom || etab.peut_emettre_carte || etab.peut_demander_transfert || etab.transfert;
  const [heures, setHeures] = useState("72");
  const [busy, setBusy] = useState(false);
  const myHospital =
    user?.structures?.find((s) => s.id && s.id === user.structure_principale)?.nom || "votre hôpital";

  if (!show) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <Card colors={colors}>
        <Text style={{ color: colors.navy, fontWeight: "800", marginBottom: 6 }}>Hôpital mère</Text>
        <Text style={{ color: colors.text }}>
          {etab.hopital_mere_nom || "Non renseigné"}
          {etab.app_activee ? " · le patient valide les demandes extérieures" : ""}
        </Text>
        {etab.medecin_referent_nom ? (
          <Text style={{ color: colors.muted, marginTop: 4 }}>Référent : {etab.medecin_referent_nom}</Text>
        ) : null}
        {etab.transfert ? (
          <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
            Transfert {etab.transfert.from_structure_nom} → {etab.transfert.to_structure_nom} · {etab.transfert.status_label}. Les deux ont accès.
          </Text>
        ) : null}
        {etab.peut_emettre_carte ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Button
              title="Photo d'identité"
              outline
              color={C.teal}
              onPress={async () => {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                  appAlert("Photo", "Autorisez la caméra.");
                  return;
                }
                const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
                if (shot.canceled || !shot.assets?.[0]) return;
                const asset = shot.assets[0];
                setBusy(true);
                try {
                  await api.uploadPatientPhoto(patientId, {
                    uri: asset.uri,
                    type: asset.mimeType || "image/jpeg",
                    name: asset.fileName || "photo.jpg",
                  });
                  appAlert("Photo", "Photo enregistrée.");
                  onChanged?.();
                } catch (e: any) {
                  appAlert("Photo", e.message || "Photo impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              title="Émettre la DotoCard"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await api.emettreCarte(patientId);
                  appAlert("DotoCard", "La carte est émise.");
                  onChanged?.();
                } catch (e: any) {
                  appAlert("DotoCard", e.message || "Émission impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
        {etab.peut_demander_transfert ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {myHospital} demande à devenir l'hôpital mère. L'hôpital actuel doit accepter. Pendant le transfert, les deux ont accès.
            </Text>
            <Field
              label="Durée conservée par l'ancien hôpital (heures)"
              value={heures}
              onChangeText={setHeures}
              keyboardType="number-pad"
              colors={colors}
            />
            <Button
              title="Demander le transfert"
              loading={busy}
              onPress={async () => {
                const hours = Number(heures);
                if (!Number.isFinite(hours) || hours < 1) {
                  appAlert("Transfert", "Indiquez la durée en heures.");
                  return;
                }
                setBusy(true);
                try {
                  await api.createHopitalTransfer({
                    patient_id: patientId,
                    duration_hours: hours,
                    ...(user?.structure_principale ? { to_structure_id: user.structure_principale } : {}),
                  });
                  appAlert("Transfert", "Demande envoyée à l'hôpital mère actuel.");
                  onChanged?.();
                } catch (e: any) {
                  appAlert("Transfert", e.message || "Transfert impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}
