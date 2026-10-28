import React, { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { appAlert } from "../components/AppDialog";
import { C, darkC } from "../theme";
import { Button, Card, Header } from "../ui";
import { BrandBackground, ScreenEnter } from "../motion";

export default function Demandes({
  dark = false,
  onBack,
  onOpenPatient,
}: {
  dark?: boolean;
  onBack: () => void;
  onOpenPatient?: (id: number) => void;
}) {
  const colors = dark ? darkC : C;
  const [rows, setRows] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inbox, xf] = await Promise.all([api.accessInbox(), api.hopitalTransfers()]);
      setRows(inbox);
      setTransfers(xf);
    } catch (e: any) {
      appAlert("Demandes", e.message || "Chargement impossible.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      appAlert("Demandes", ok);
      await load();
    } catch (e: any) {
      appAlert("Demandes", e.message || "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title="Demandes d'accès"
          subtitle="Accueil ou médecin référent"
          onBack={onBack}
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          <Text style={{ color: colors.muted, lineHeight: 18 }}>
            Sans médecin référent, seul l'accueil accepte. Si le patient active son téléphone, les demandes extérieures lui reviennent.
          </Text>
          {rows.length === 0 ? (
            <Card colors={colors}>
              <Text style={{ color: colors.muted }}>Aucune demande en attente.</Text>
            </Card>
          ) : (
            rows.map((r) => (
              <Card key={r.id} colors={colors}>
                <Text style={{ color: colors.navy, fontWeight: "800" }}>{r.patient_name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  {r.requester_name}
                  {r.structure ? ` · ${r.structure}` : ""}
                </Text>
                <Text style={{ color: colors.text, marginTop: 4 }}>
                  {r.duration_label || (r.requested_duration_hours ? `${r.requested_duration_hours} h` : "")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Accepter"
                      loading={busy}
                      onPress={() => void act(() => api.approveAccess(r.id), "Accès accordé pour la durée demandée")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Refuser"
                      outline
                      loading={busy}
                      onPress={() => void act(() => api.denyAccess(r.id), "Demande refusée")}
                    />
                  </View>
                </View>
                {onOpenPatient ? (
                  <View style={{ marginTop: 8 }}>
                    <Button title="Voir le dossier" outline onPress={() => onOpenPatient(r.patient_id)} />
                  </View>
                ) : null}
              </Card>
            ))
          )}

          <Text style={{ color: colors.navy, fontWeight: "800", marginTop: 8 }}>Transferts d'hôpital mère</Text>
          {transfers.length === 0 ? (
            <Card colors={colors}>
              <Text style={{ color: colors.muted }}>Aucun transfert en cours.</Text>
            </Card>
          ) : (
            transfers.map((t) => (
              <Card key={t.id} colors={colors}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>{t.patient_name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  {t.from_structure_nom} → {t.to_structure_nom}
                </Text>
                <Text style={{ color: colors.text, marginTop: 4 }}>{t.status_label}</Text>
                <View style={{ gap: 8, marginTop: 12 }}>
                  {t.peut_accepter ? (
                    <>
                      <Button title="Accepter" loading={busy} onPress={() => void act(() => api.approveHopitalTransfer(t.id), "Accord enregistré")} />
                      <Button title="Refuser" outline loading={busy} onPress={() => void act(() => api.denyHopitalTransfer(t.id), "Transfert refusé")} />
                    </>
                  ) : null}
                  {t.peut_confirmer ? (
                    <Button
                      title="Confirmer le transfert"
                      loading={busy}
                      onPress={() => void act(() => api.confirmHopitalTransfer(t.id), "Nouvel hôpital mère confirmé")}
                    />
                  ) : null}
                  {t.peut_annuler ? (
                    <Button title="Annuler" outline loading={busy} onPress={() => void act(() => api.cancelHopitalTransfer(t.id), "Transfert annulé")} />
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </ScreenEnter>
    </BrandBackground>
  );
}
