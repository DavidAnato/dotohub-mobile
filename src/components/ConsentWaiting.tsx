/** Bannière / écran attente consentement - DotoHub Mobile. */
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, darkC } from "../theme";
import { Card } from "../ui";
import { PressScale } from "../motion";

function waitingHint(role?: string): string {
  switch (role) {
    case "pharmacien":
      return "Portée demandée : ordonnances.";
    case "laborantin":
      return "Portée demandée : examens / résultats labo.";
    case "infirmier":
      return "Portée demandée : constantes et notes de soins.";
    case "receptionniste":
      return "Portée demandée : identité et assurance.";
    case "ambulancier":
      return "Portée demandée : informations d'urgence.";
    case "medecin":
    case "admin":
      return "Portée demandée : dossier médical.";
    default:
      return "";
  }
}

export function ConsentWaitingView({
  patientName,
  emergency,
  role,
  dark,
  onCancel,
}: {
  patientName?: string;
  emergency?: boolean;
  /** Rôle du pro demandeur - adapte le message d'attente. */
  role?: string;
  dark?: boolean;
  onCancel?: () => void;
}) {
  const colors = dark ? darkC : C;

  if (emergency) {
    return (
      <View
        style={{
          margin: 16,
          backgroundColor: colors.emergencySoft || "#FDE8E8",
          borderLeftWidth: 4,
          borderLeftColor: C.emergency,
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: C.emergency + "33",
        }}
      >
        <Text style={{ color: C.emergency, fontWeight: "800", fontSize: 13 }}>
          Accès urgence sans consentement - journalisé
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
          Ouverture limitée (groupe sanguin, allergies, chroniques, contacts). Toute action
          est tracée.
        </Text>
      </View>
    );
  }

  const hint = waitingHint(role);

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Card colors={colors} decor="teal" style={{ alignItems: "center", gap: 14, paddingVertical: 32 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: C.teal + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color={C.teal} />
        </View>
        <Text style={{ color: colors.navy, fontWeight: "800", fontSize: 17, textAlign: "center" }}>
          Demande envoyée au patient…
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
          {patientName
            ? `${patientName} doit confirmer dans l'application DOTO+.`
            : "Le patient doit confirmer dans l'application DOTO+."}
        </Text>
        {hint ? (
          <Text
            style={{
              color: colors.navy,
              fontSize: 12,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {hint}
          </Text>
        ) : null}
        {onCancel ? (
          <PressScale
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Annuler et revenir"
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.white,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.muted} />
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 14 }}>Annuler</Text>
          </PressScale>
        ) : null}
      </Card>
    </View>
  );
}
