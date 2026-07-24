import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { C, darkC } from "../theme";

export type PatientOption = {
  id: number;
  full_name?: string;
  nom?: string;
  prenom?: string;
  npi?: string;
  suggestion_reason?: string;
};

function labelOf(p: PatientOption) {
  return p.full_name || `${p.prenom || ""} ${p.nom || ""}`.trim() || `Patient #${p.id}`;
}

type Props = {
  value: string;
  onChange: (patientId: string, patient?: PatientOption | null) => void;
  dark?: boolean;
  placeholder?: string;
};

function PatientSelectSearch({
  value,
  onChange,
  dark = false,
  placeholder = "Rechercher un patient…",
}: Props) {
  const colors = dark ? darkC : C;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel = useMemo(() => {
    if (selected && String(selected.id) === value) return labelOf(selected);
    return "";
  }, [selected, value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void load(q);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const load = async (query: string) => {
    setLoading(true);
    try {
      const list = await api.patientSuggestions({ q: query.trim() || undefined, limit: 20 });
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = (p: PatientOption) => {
    setSelected(p);
    onChange(String(p.id), p);
    setQ("");
    setOpen(false);
  };

  if (value && selectedLabel) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          backgroundColor: colors.white,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.lightBlue || C.lightBlue,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={20} color={C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>{selectedLabel}</Text>
            {selected?.npi ? (
              <Text style={{ color: colors.muted, fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>
                {selected.npi}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => {
            setSelected(null);
            onChange("", null);
            setOpen(true);
            void load("");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 12,
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.teal + "55",
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color={C.teal} />
          <Text style={{ color: C.teal, fontWeight: "700" }}>Changer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ zIndex: 20 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
        Patient
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 12,
          backgroundColor: colors.white,
          minHeight: 48,
          gap: 8,
        }}
      >
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!items.length) void load(q);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: colors.text,
            fontSize: 15,
          }}
        />
        {loading ? <ActivityIndicator color={C.navy} size="small" /> : null}
      </View>
      {open ? (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            backgroundColor: colors.white,
            maxHeight: 220,
            overflow: "hidden",
          }}
        >
          {loading && items.length === 0 ? (
            <View style={{ padding: 14, alignItems: "center" }}>
              <ActivityIndicator color={C.navy} />
            </View>
          ) : null}
          {!loading && items.length === 0 ? (
            <Text style={{ color: colors.muted, padding: 14 }}>Aucun patient.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(p) => String(p.id)}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220 }}
              renderItem={({ item: p }) => (
                <Pressable
                  onPress={() => pick(p)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    minHeight: 52,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Ionicons name="person-outline" size={18} color={C.teal} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{labelOf(p)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {p.npi || `#${p.id}`}
                      {p.suggestion_reason === "recent" ? " · récent" : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

export { PatientSelectSearch };
export default PatientSelectSearch;
