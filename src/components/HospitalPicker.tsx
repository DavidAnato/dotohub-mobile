import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { starOn } from "../theme";

type Hospital = { id: number; nom: string; commune?: string; department?: string };

function hospitalLabel(h: Hospital) {
  return h.commune ? `${h.nom} · ${h.commune}` : h.nom;
}

export function HospitalPicker({
  hospitals,
  pickedIds,
  principalId,
  onChangePicked,
  onChangePrincipal,
  colors,
}: {
  hospitals: Hospital[];
  pickedIds: number[];
  principalId: number | "";
  onChangePicked: (ids: number[]) => void;
  onChangePrincipal: (id: number | "") => void;
  colors: { text: string; muted: string; border: string; white: string; bg?: string };
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();

  const picked = useMemo(
    () => hospitals.filter((h) => pickedIds.includes(h.id)),
    [hospitals, pickedIds]
  );

  const filtered = useMemo(() => {
    if (!query) return hospitals;
    return hospitals.filter((h) => {
      const hay = `${h.nom} ${h.commune || ""} ${h.department || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [hospitals, query]);

  const applyNext = (next: number[]) => {
    onChangePicked(next);
    if (principalId && !next.includes(Number(principalId))) {
      onChangePrincipal(next[0] || "");
    } else if (!principalId && next.length) {
      onChangePrincipal(next[0]);
    }
  };

  const toggle = (id: number) => {
    applyNext(pickedIds.includes(id) ? pickedIds.filter((x) => x !== id) : [...pickedIds, id]);
  };

  return (
    <View style={{ marginBottom: 8 }}>
      {picked.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {picked.map((h) => {
            const principal = principalId === h.id;
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: "100%",
                  paddingVertical: 6,
                  paddingLeft: 8,
                  paddingRight: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: principal ? starOn : colors.border,
                  backgroundColor: colors.white,
                }}
              >
                <Pressable
                  onPress={() => onChangePrincipal(h.id)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    principal ? `${h.nom}, établissement principal` : `Définir ${h.nom} comme principal`
                  }
                >
                  <Ionicons
                    name={principal ? "star" : "star-outline"}
                    size={16}
                    color={principal ? starOn : colors.muted}
                  />
                </Pressable>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, maxWidth: 160 }} numberOfLines={1}>
                  {h.nom}
                </Text>
                <Pressable onPress={() => toggle(h.id)} accessibilityLabel={`Retirer ${h.nom}`}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {!hospitals.length ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 8 }}>
          Catalogue indisponible. Saisissez le nom ci-dessous.
        </Text>
      ) : (
        <View>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: open ? "#2BB3BC" : colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: colors.white,
            }}
          >
            <Ionicons name="search" size={16} color={colors.muted} />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 15 }}>
              {picked.length ? "Ajouter un établissement" : "Choisir un établissement"}
            </Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Pressable>

          {open ? (
            <View
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: colors.white,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Ionicons name="search" size={16} color={colors.muted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher par nom ou ville"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoFocus
                  style={{ flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 }}
                />
              </View>
              {!filtered.length ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, margin: 12 }}>
                  Aucun établissement pour « {q.trim()} ».
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filtered.map((h, i) => {
                    const on = pickedIds.includes(h.id);
                    return (
                      <Pressable
                        key={h.id}
                        onPress={() => toggle(h.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: on ? "rgba(43,179,188,0.08)" : "transparent",
                          borderTopWidth: i ? 1 : 0,
                          borderTopColor: colors.border,
                        }}
                      >
                        <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? "#2BB3BC" : colors.muted} />
                        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2}>
                          {hospitalLabel(h)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>
      )}

      {picked.length ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
          L'étoile désigne le principal : lieu proposé par défaut en consultation.
        </Text>
      ) : null}
    </View>
  );
}
