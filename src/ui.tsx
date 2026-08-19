import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, brandNavy, onBrand, accent } from "./theme";
import { PressScale, IconBadge, CardDecor } from "./motion";
import { BJ_DIAL, formatNational, nationalDigits, toE164Bj } from "./phone";
import { useScreenInsets } from "./safeArea";

export type ThemeColors = typeof C;

/** Échelle d’espacement normalisée */
export const space = { xs: 8, sm: 12, md: 16, lg: 24 } as const;

export function Card({
  children,
  style,
  colors = C,
  onPress,
  decor = "soft",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: ThemeColors;
  onPress?: () => void;
  decor?: "soft" | "teal" | "navy" | "calm" | "none";
}) {
  const darkish = colors.bg === "#0A0A0A" || colors.bg === "#111111" || colors.white === "#161616";
  const base: StyleProp<ViewStyle> = [
    s.card,
    {
      backgroundColor: colors.white,
      borderColor: colors.border,
      shadowColor: "#1E3755",
      overflow: "hidden",
    },
    style,
  ];
  // CardDecor is absolute + pointerEvents none - keep children as direct layout children
  // so flexDirection / gap / alignItems on `style` apply correctly.
  const inner = (
    <>
      {decor !== "none" ? <CardDecor variant={decor} dark={darkish} /> : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <PressScale onPress={onPress} style={base}>
        {inner}
      </PressScale>
    );
  }
  return <View style={base}>{inner}</View>;
}

export function SectionLabel({
  children,
  color = C.navy,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <Text style={[s.sectionLabel, { color }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  color = C.blue,
  outline = false,
  disabled = false,
  loading = false,
  icon,
  compact = false,
  style,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Bouton plus étroit (chips / actions secondaires en ligne) */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = outline ? color : onBrand;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        s.btn,
        compact && s.btnCompact,
        outline
          ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: color }
          : {
              backgroundColor: color,
              shadowColor: color,
              shadowOpacity: 0.22,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 2,
            },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.btnInner}>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={fg} /> : null}
          <Text
            style={{
              color: fg,
              fontWeight: "800",
              fontSize: compact ? 13 : 15,
              letterSpacing: 0.2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  colors = C,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  colors?: ThemeColors;
  maxLength?: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isSecret = !!secureTextEntry;

  const inputBg = colors.bg === C.bg ? colors.white : colors.bg;

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View>
        <TextInput
          style={[
            s.input,
            {
              borderColor: focused ? accent : colors.border,
              backgroundColor: inputBg,
              color: colors.text,
              paddingRight: isSecret ? 48 : 16,
              shadowOpacity: focused ? 1 : 0,
              shadowColor: "rgba(43, 179, 188, 0.28)",
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.grey}
          secureTextEntry={isSecret && !revealed}
          keyboardType={keyboardType}
          autoCapitalize="none"
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isSecret ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            hitSlop={8}
            style={s.eyeBtn}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Téléphone BJ : +229 verrouillé + numéro national formaté.
 */
export function PhoneField({
  label,
  value,
  onChangeText,
  placeholder = "97 45 12 88",
  colors = C,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (full: string) => void;
  placeholder?: string;
  colors?: ThemeColors;
  disabled?: boolean;
}) {
  const inputBg = disabled
    ? colors.bg === C.bg
      ? "#EEF1F4"
      : "#1A1A1A"
    : colors.bg === C.bg
      ? colors.white
      : colors.bg;
  const local = formatNational(nationalDigits(value));
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: space.md, opacity: disabled ? 0.72 : 1 }}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          borderWidth: 1.5,
          borderRadius: 14,
          borderColor: focused ? accent : colors.border,
          backgroundColor: inputBg,
          overflow: "hidden",
          minHeight: 52,
        }}
      >
        <View
          style={{
            paddingHorizontal: 12,
            justifyContent: "center",
            backgroundColor: colors.bg === C.bg ? colors.lightBlue : "#1A2228",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={{ fontWeight: "800", color: brandNavy, fontSize: 15, letterSpacing: 0.3 }}>
            {BJ_DIAL}
          </Text>
        </View>
        <TextInput
          style={{
            flex: 1,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontSize: 15,
            color: disabled ? colors.muted : colors.text,
            letterSpacing: 0.6,
          }}
          value={local}
          onChangeText={(t) => onChangeText(toE164Bj(t))}
          placeholder={placeholder}
          placeholderTextColor={colors.grey}
          keyboardType="phone-pad"
          autoCapitalize="none"
          maxLength={14}
          editable={!disabled}
          accessibilityLabel={`${label}, indicatif ${BJ_DIAL}`}
          accessibilityState={{ disabled }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
        Indicatif Bénin prérempli - saisissez uniquement le numéro local.
      </Text>
    </View>
  );
}

export function AuthScreenHeader({
  title,
  subtitle,
  onBack,
  colors = C,
  brand,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  colors?: ThemeColors;
  brand?: React.ReactNode;
}) {
  const { headerPad } = useScreenInsets();
  const darkish = colors.bg === "#0A0A0A" || colors.white === "#161616";
  const titleColor = darkish ? colors.text : brandNavy;
  return (
    <View style={{ paddingTop: headerPad + 10, paddingHorizontal: 24, marginBottom: 8 }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={10}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 18, alignSelf: "flex-start" }}
        >
          <Ionicons name="chevron-back" size={22} color={titleColor} />
          <Text style={{ color: titleColor, fontWeight: "700", fontSize: 14 }}>Retour</Text>
        </Pressable>
      ) : null}
      {brand}
      <Text
        style={{
          color: titleColor,
          fontSize: 26,
          fontWeight: "800",
          letterSpacing: -0.5,
          lineHeight: 32,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  colors?: ThemeColors;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const { headerPad } = useScreenInsets();
  return (
    <View
      style={{
        backgroundColor: brandNavy,
        paddingHorizontal: space.md,
        paddingTop: headerPad,
        paddingBottom: space.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: -6,
              marginRight: 2,
            }}
          >
            <Ionicons name="chevron-back" size={28} color={onBrand} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: onBrand, fontSize: 20, fontWeight: "800", letterSpacing: 0.2 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}

function UrgenceSnapRow({
  icon,
  label,
  value,
  colors,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ThemeColors;
  last?: boolean;
}) {
  const darkish = colors.bg === "#0A0A0A" || colors.white === "#161616";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: darkish ? "#1A1010" : colors.emergencySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={16} color={C.emergency} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: colors.muted,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{ color: colors.text, fontWeight: "700", fontSize: 14, marginTop: 1 }}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export function UrgenceBanner({
  u,
  colors = C,
  style,
}: {
  u: any;
  colors?: ThemeColors;
  style?: StyleProp<ViewStyle>;
}) {
  if (!u) return null;
  const allergies = (u.allergies || []).length
    ? (u.allergies || []).join(" · ")
    : "Non identifié";
  const gs = (u.groupe_sanguin || "").trim() || "Non identifié";
  const electro = (u.electrophorese || "").trim() || "Non identifié";
  const hasInsurance = !!(u.assureur || u.num_police);
  const contact = [
    u.contact_urgence_nom
      ? `${u.contact_urgence_nom}${u.contact_urgence_lien ? ` (${u.contact_urgence_lien})` : ""}`
      : null,
    u.tel_urgence || null,
  ]
    .filter(Boolean)
    .join(" · ") || "-";

  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: 16,
          marginHorizontal: space.md,
          marginTop: space.sm,
          marginBottom: space.sm,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View style={{ height: 3, backgroundColor: C.emergency }} />
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: C.emergency,
            }}
          />
          <Text
            style={{
              color: C.emergency,
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 2.5,
            }}
          >
            URGENCE
          </Text>
        </View>
        <UrgenceSnapRow icon="water" label="Groupe sanguin" value={gs} colors={colors} />
        <UrgenceSnapRow icon="flask" label="Électrophorèse" value={electro} colors={colors} />
        <UrgenceSnapRow icon="warning-outline" label="Allergies" value={allergies} colors={colors} />
        <UrgenceSnapRow
          icon="person-outline"
          label="Contact"
          value={contact}
          colors={colors}
          last={!hasInsurance}
        />
        {hasInsurance ? (
          <UrgenceSnapRow
            icon="shield-checkmark-outline"
            label="Assurance"
            value={`${u.assureur || "-"} · ${u.num_police || "-"}`}
            colors={colors}
            last
          />
        ) : null}
      </View>
    </View>
  );
}

export { IconBadge };

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: space.md,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnCompact: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 14,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    minHeight: 52,
  },
  eyeBtn: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 12,
    zIndex: 2,
  },
});
