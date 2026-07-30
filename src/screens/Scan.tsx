import React, { useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Switch,
  useWindowDimensions,
} from "react-native";
import { appAlert } from "../components/AppDialog";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { C, darkC, brandNavy, onBrand } from "../theme";
import { api } from "../api";
import { Header, Button, Card } from "../ui";
import {
  EmptyState,
  PressScale,
  ScreenEnter,
  CardDecor,
  hapticSuccess,
} from "../motion";

export default function Scan({
  onScanned,
  onPendingConsent,
  dark = false,
}: {
  onScanned?: (
    patientId: number,
    npi: string,
    meta?: { emergency?: boolean; urgence?: any }
  ) => void;
  onPendingConsent?: (info: {
    patientId: number;
    npi: string;
    name: string;
    accessRequestId?: number;
  }) => void;
  dark?: boolean;
}) {
  const colors = dark ? darkC : C;
  const { width } = useWindowDimensions();
  const frameSize = Math.min(width - 64, 260);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState("");
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const locked = useRef(false);

  // Caméra uniquement à l’écran focus ; stop net au blur/unmount
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      setCameraLive(true);
      return () => {
        locked.current = true;
        setCameraLive(false);
      };
    }, [])
  );

  const cameraOn = isFocused && cameraLive;

  const handleScan = async ({ data }: { data: string }) => {
    if (!data || busy || locked.current) return;
    locked.current = true;
    setBusy(true);
    setLastMsg("");
    try {
      const res = await api.scanDotoCard(data.trim(), emergency);
      const name =
        res.urgence?.full_name ||
        (res.urgence?.nom
          ? `${res.urgence.prenom || ""} ${res.urgence.nom || ""}`.trim()
          : res.npi);

      if (res.consent_required) {
        setLastMsg(`En attente · ${name}`);
        onPendingConsent?.({
          patientId: res.patient_id,
          npi: res.npi,
          name,
          accessRequestId: res.access_request?.id,
        });
      } else {
        const isEmergency = !!(res.emergency || emergency);
        setLastMsg(`OK · ${name}${isEmergency ? " · Urgence" : ""}`);
        hapticSuccess();
        onScanned?.(res.patient_id, res.npi, {
          emergency: isEmergency,
          urgence: res.urgence,
        });
      }
    } catch (e: any) {
      setLastMsg(e.message || "Scan échoué");
      appAlert("Échec", e.message || "Token invalide.");
    } finally {
      setBusy(false);
      setTimeout(() => {
        locked.current = false;
      }, 2500);
    }
  };

  if (!permission) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.muted, fontWeight: "600" }}>Vérification caméra…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Scan DotoCard" subtitle="Consentement patient sauf urgence" />
        <ScreenEnter>
          <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
            <Card colors={colors} decor="teal" style={{ alignItems: "center", gap: 14, paddingVertical: 28 }}>
              <EmptyState
                icon="camera-outline"
                title="Caméra requise"
                subtitle="Autorisez la caméra pour scanner une DotoCard."
                dark={dark}
              />
              <View style={{ width: "100%", paddingHorizontal: 8 }}>
                <Button
                  title="Autoriser"
                  icon="camera-outline"
                  onPress={requestPermission}
                  color={brandNavy}
                />
              </View>
            </Card>
          </View>
        </ScreenEnter>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Scan DotoCard" subtitle="Alignez le QR dans le cadre" />
      <ScreenEnter>
        <View style={{ flex: 1, padding: 16, gap: 14 }}>
          {/* Preview caméra encadrée */}
          <View
            style={[
              s.previewWrap,
              {
                height: frameSize + 48,
                borderColor: colors.border,
                backgroundColor: "#0B1220",
              },
            ]}
          >
            <CardDecor variant="navy" dark />
            <View style={[s.previewInner, { width: frameSize, height: frameSize }]}>
              {cameraOn ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  active
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={busy ? undefined : handleScan}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.cameraOff]} />
              )}
              <View style={s.cornerTL} />
              <View style={s.cornerTR} />
              <View style={s.cornerBL} />
              <View style={s.cornerBR} />
              {busy ? (
                <View style={s.busyOverlay}>
                  <Text style={s.busyText}>Envoi…</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Mode urgence */}
          <Card
            colors={colors}
            decor="none"
            style={[
              s.emergencyCard,
              {
                backgroundColor: emergency ? colors.emergencySoft : colors.white,
                borderColor: emergency ? C.emergency + "55" : colors.border,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: emergency ? C.emergency + "22" : colors.lightTeal,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={emergency ? C.emergency : C.teal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                  Mode urgence
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                  Bypass consentement — accès limité journalisé
                </Text>
              </View>
              <Switch
                value={emergency}
                onValueChange={(v) => {
                  if (!v) {
                    setEmergency(false);
                    return;
                  }
                  appAlert(
                    "Mode urgence",
                    "Bypass consentement — accès limité et journalisé. Continuer ?",
                    [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Activer",
                        style: "destructive",
                        onPress: () => setEmergency(true),
                      },
                    ]
                  );
                }}
                trackColor={{ false: colors.border, true: C.emergency }}
                thumbColor={onBrand}
              />
            </View>
          </Card>

          {lastMsg ? (
            <Text
              style={{
                color: lastMsg.startsWith("OK") ? C.teal : colors.amber,
                fontWeight: "700",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {lastMsg}
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", fontWeight: "600" }}>
              Présentez la DotoCard du patient face à la caméra
            </Text>
          )}

          {/* Saisie manuelle repliée */}
          <PressScale
            onPress={() => setShowManual((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
            }}
          >
            <Ionicons
              name={showManual ? "chevron-up" : "keypad-outline"}
              size={16}
              color={C.teal}
            />
            <Text style={{ color: C.teal, fontWeight: "700", fontSize: 13 }}>
              {showManual ? "Masquer la saisie" : "Saisie manuelle du token"}
            </Text>
          </PressScale>

          {showManual ? (
            <Card colors={colors} decor="calm" style={{ gap: 10 }}>
              <TextInput
                value={manual}
                onChangeText={setManual}
                placeholder="Token DotoCard"
                placeholderTextColor={colors.grey}
                style={[
                  s.input,
                  {
                    backgroundColor: dark ? colors.bg : "#F8FAFC",
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                title="Valider"
                icon="checkmark-circle-outline"
                onPress={() => handleScan({ data: manual })}
                color={C.teal}
                loading={busy}
                disabled={!manual.trim()}
              />
            </Card>
          ) : null}
        </View>
      </ScreenEnter>
    </View>
  );
}

const CORNER = {
  width: 28,
  height: 28,
  borderColor: "#fff",
  position: "absolute" as const,
};

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewWrap: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewInner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  cameraOff: { backgroundColor: "#000" },
  cornerTL: {
    ...CORNER,
    top: 12,
    left: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    ...CORNER,
    top: 12,
    right: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    ...CORNER,
    bottom: 12,
    left: 12,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    ...CORNER,
    bottom: 12,
    right: 12,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  busyText: { color: "#fcd34d", fontWeight: "800", fontSize: 15 },
  emergencyCard: {
    paddingVertical: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
