import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";

type ThemeColors = typeof C;
const space = { md: 16 } as const;

function formatFrDate(d: Date) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatFrTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function DateTimePickerField({
  value,
  onChange,
  colors = C,
  label = "Date et heure",
  minimumDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  colors?: ThemeColors;
  label?: string;
  minimumDate?: Date;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const labelColor = colors.navy === C.navy ? C.navy : colors.text;

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setMode(null);
    if (event.type === "dismissed") {
      setMode(null);
      return;
    }
    if (!selected) return;
    const next = new Date(value);
    if (mode === "date") {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    onChange(next);
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 6, color: labelColor }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setMode("date")}
          style={{
            flex: 1.4,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={C.teal} />
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, flex: 1 }}>
            {formatFrDate(value)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("time")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Ionicons name="time-outline" size={18} color={C.teal} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
            {formatFrTime(value)}
          </Text>
        </Pressable>
      </View>
      {mode ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
          minimumDate={minimumDate}
          locale="fr-FR"
          is24Hour
        />
      ) : null}
      {Platform.OS === "ios" && mode ? (
        <Pressable onPress={() => setMode(null)} style={{ alignSelf: "flex-end", marginTop: 6 }}>
          <Text style={{ color: C.teal, fontWeight: "800" }}>OK</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function toIsoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function defaultRdvDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
