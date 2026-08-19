import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, accent } from "../theme";

type Hospital = { id: number; nom: string; commune?: string; department?: string };

const PREVIEW = 8;

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

  const visible = query ? filtered : filtered.slice(0, PREVIEW);
  const hiddenCount = query ? 0 : Math.max(0, filtered.length - visible.length);

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
                  borderColor: principal ? accent : colors.border,
                  backgroundColor: principal ? "rgba(43,179,188,0.12)" : colors.white,
                }}
              >
                <Pressable
                  onPress={() => onChangePrincipal(h.id)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    principal ? `${h.nom}, établissement principal` : `Définir ${h.nom} comme principal`
                  }
                >
                  <Ionicons name={principal ? "star" : "star-outline"} size={16} color={principal ? C.teal : colors.muted} />
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
      ) : (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 10 }}>
          Aucun établissement choisi pour l'instant.
        </Text>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          marginBottom: 10,
          backgroundColor: colors.white,
        }}
      >
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher par nom ou ville"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={{ flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 }}
        />
      </View>

      {!hospitals.length ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 8 }}>
          Catalogue indisponible. Saisissez le nom ci-dessous.
        </Text>
      ) : !visible.length ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 8 }}>
          Aucun établissement pour « {q.trim()} ».
        </Text>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: "hidden",
            maxHeight: 280,
          }}
        >
          {visible.map((h, i) => {
            const on = pickedIds.includes(h.id);
            const principal = principalId === h.id;
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: on ? "rgba(43,179,188,0.08)" : "transparent",
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <Pressable
                  onPress={() => toggle(h.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
                >
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? C.teal : colors.muted} />
                  <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2}>
                    {hospitalLabel(h)}
                  </Text>
                </Pressable>
                {on ? (
                  <Pressable
                    onPress={() => onChangePrincipal(h.id)}
                    accessibilityLabel={principal ? "Établissement principal" : `Définir ${h.nom} comme principal`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: principal ? accent : colors.border,
                      backgroundColor: principal ? "rgba(43,179,188,0.14)" : "transparent",
                    }}
                  >
                    <Ionicons name={principal ? "star" : "star-outline"} size={14} color={principal ? C.teal : colors.muted} />
                    <Text style={{ color: principal ? C.teal : colors.muted, fontSize: 11, fontWeight: "700" }}>
                      {principal ? "Principal" : "Principal ?"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      {hiddenCount ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
          {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} dans le catalogue. Tapez pour affiner.
        </Text>
      ) : null}
      {picked.length ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
          L'étoile désigne le principal : lieu proposé par défaut en consultation.
        </Text>
      ) : null}
    </View>
  );
}
