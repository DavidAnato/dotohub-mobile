import React, { useEffect, useState } from "react";
import { Image, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

function initialsFrom(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 48,
  style,
  bg: _bg,
  textColor = "#fff",
  ring = true,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  /** Conservé pour compat — le fallback utilise le dégradé marque. */
  bg?: string;
  textColor?: string;
  ring?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [uri]);
  const initials = initialsFrom(name);
  const radius = size / 2;
  const ringW = Math.max(1.5, size * 0.04);

  const wrapStyle = [
    ring
      ? {
          padding: ringW,
          borderRadius: radius + ringW,
          backgroundColor: "rgba(62, 130, 149, 0.35)",
        }
      : undefined,
    style,
  ];

  if (uri && !broken) {
    return (
      <View style={wrapStyle}>
        <Image
          source={{ uri }}
          onError={() => setBroken(true)}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: C.navy,
          }}
        />
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      <LinearGradient
        colors={["#1E3755", "#2A5470", "#3E8295"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: textColor, fontWeight: "800", fontSize: size * 0.32, letterSpacing: 0.5 }}>
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
}
