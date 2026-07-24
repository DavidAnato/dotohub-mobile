import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  Pressable,
  PressableProps,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "./theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ENTER_MS = 200;
const PRESS_MS = 140;
const STAGGER_STEP = 22;

export async function hapticLight() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* web / simulator */
  }
}

export async function hapticMedium() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* ignore */
  }
}

export async function hapticSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* ignore */
  }
}

/** Entrée d'écran : fade opacity uniquement (évite overlaps flex/layout). */
export function ScreenEnter({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(delay)
        .duration(ENTER_MS)
        .easing(Easing.out(Easing.quad))}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Item de liste — stagger opacity uniquement (cap 5 items). */
export function StaggerItem({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 5) * STAGGER_STEP)
        .duration(180)
        .easing(Easing.out(Easing.quad))}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Press scale doux + haptic */
export function PressScale({
  children,
  onPress,
  style,
  disabled,
  haptic = true,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.985, 1], [0.94, 1]),
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(0.985, { duration: PRESS_MS, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: PRESS_MS + 20, easing: Easing.out(Easing.quad) });
      }}
      onPress={(e) => {
        if (haptic) hapticLight();
        onPress?.(e);
      }}
      style={[anim, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Feedback succès discret (toast inline) */
export function SuccessFlash({
  visible,
  message = "Enregistré",
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(8,80,65,0.92)",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: "center",
      }}
    >
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{message}</Text>
    </Animated.View>
  );
}

/** Fond décoratif de carte (blobs + mesh) */
export function CardDecor({
  variant = "soft",
  dark = false,
}: {
  variant?: "soft" | "teal" | "navy" | "calm";
  dark?: boolean;
}) {
  const blobs =
    variant === "teal"
      ? ["rgba(62,130,149,0.14)", "rgba(30,55,85,0.08)"]
      : variant === "navy"
        ? ["rgba(30,55,85,0.12)", "rgba(62,130,149,0.10)"]
        : variant === "calm"
          ? ["rgba(62,130,149,0.08)", "rgba(30,55,85,0.05)"]
          : ["rgba(62,130,149,0.10)", "rgba(30,55,85,0.07)"];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={
          dark
            ? (["rgba(62,130,149,0.10)", "transparent", "rgba(255,255,255,0.03)"] as const)
            : (["rgba(232,242,245,0.95)", "rgba(255,255,255,0.4)", "rgba(30,55,85,0.04)"] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: "absolute",
          top: -28,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: blobs[0],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -36,
          left: -24,
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: blobs[1],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 18,
          left: 12,
          width: 36,
          height: 36,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: dark ? "rgba(62,130,149,0.25)" : "rgba(62,130,149,0.18)",
          transform: [{ rotate: "18deg" }],
          opacity: 0.55,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 22,
          right: 28,
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: dark ? "rgba(62,130,149,0.22)" : "rgba(30,55,85,0.08)",
          transform: [{ rotate: "32deg" }],
        }}
      />
    </View>
  );
}

/** Fond dégradé soft navy → teal → bg */
export function BrandBackground({
  children,
  dark = false,
  style,
}: {
  children?: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const top = dark ? "#111111" : "#E8F2F5";
  const mid = dark ? "#0D0D0D" : "#F0F7F9";
  const bottom = dark ? "#0A0A0A" : "#F3F4F6";
  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient
        colors={[top, mid, bottom]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!dark ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: "rgba(62,130,149,0.08)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 120,
              left: -50,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "rgba(30,55,85,0.05)",
            }}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

/** Header bandeau avec léger gradient */
export function GradientHeader({
  children,
  emergency = false,
}: {
  children: React.ReactNode;
  emergency?: boolean;
}) {
  const colors = emergency
    ? (["#A32D2D", "#791F1F"] as const)
    : ([C.navy, "#2A4A66", C.blue] as const);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
    >
      {children}
    </LinearGradient>
  );
}

/** Bone skeleton avec shimmer doux */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  style,
  dark = false,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [t]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.4, 0.75]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: dark ? "#2A2A2A" : "#D1D9E0",
        },
        anim,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ dark = false }: { dark?: boolean }) {
  const bg = dark ? "#161616" : "#fff";
  const border = dark ? "#2A2A2A" : "rgba(30,55,85,0.08)";
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: border,
        gap: 10,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <CardDecor dark={dark} variant="calm" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, zIndex: 1 }}>
        <Skeleton width={40} height={40} radius={12} dark={dark} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} dark={dark} />
          <Skeleton width="45%" height={10} dark={dark} />
        </View>
      </View>
      <View style={{ zIndex: 1, gap: 8 }}>
        <Skeleton width="100%" height={10} dark={dark} />
        <Skeleton width="88%" height={10} dark={dark} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4, dark = false }: { count?: number; dark?: boolean }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <StaggerItem key={i} index={i}>
          <SkeletonCard dark={dark} />
        </StaggerItem>
      ))}
    </View>
  );
}

export function HomeSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1 }}>
            <Skeleton height={88} radius={16} dark={dark} />
          </View>
        ))}
      </View>
      <Skeleton height={72} radius={16} dark={dark} />
      <SkeletonList count={3} dark={dark} />
    </View>
  );
}

export function EmptyState({
  icon = "folder-open-outline",
  title,
  subtitle,
  dark = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          backgroundColor: dark ? "rgba(62,130,149,0.2)" : C.lightBlue,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          borderWidth: 1,
          borderColor: dark ? "rgba(62,130,149,0.35)" : "rgba(62,130,149,0.25)",
          overflow: "hidden",
        }}
      >
        <CardDecor dark={dark} variant="teal" />
        <Ionicons name={icon} size={32} color={C.blue} />
      </View>
      <Text
        style={{
          color: dark ? "#E2E8F0" : C.navy,
          fontWeight: "800",
          fontSize: 16,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: dark ? "#94A3B8" : C.muted,
            fontSize: 13,
            textAlign: "center",
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** Badge icône rond */
export function IconBadge({
  name,
  color = C.blue,
  bg,
  size = 36,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: bg || color + "18",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: color + "30",
      }}
    >
      <Ionicons name={name} size={size * 0.48} color={color} />
    </View>
  );
}

/** Boot splash animé (pulse discret) */
export function BootSplash({ label }: { label: string }) {
  const pulse = useSharedValue(0.97);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 900 }),
        withTiming(0.97, { duration: 900 })
      ),
      -1,
      false
    );
  }, [pulse]);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [0.97, 1.02], [0.9, 1]),
  }));

  return (
    <LinearGradient
      colors={[C.navy, "#243F5C", C.blue]}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={logoStyle}>{/* children injected by App */}</Animated.View>
      <Text style={{ color: "#fff", marginTop: 16, fontWeight: "800", fontSize: 18, letterSpacing: 1 }}>
        {label}
      </Text>
      <View style={{ height: 20 }} />
      <BootDots />
    </LinearGradient>
  );
}

function BootDots() {
  const a = useSharedValue(0.35);
  const b = useSharedValue(0.35);
  const c = useSharedValue(0.35);
  useEffect(() => {
    a.value = withRepeat(
      withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })),
      -1
    );
    b.value = withDelay(
      100,
      withRepeat(
        withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })),
        -1
      )
    );
    c.value = withDelay(
      200,
      withRepeat(
        withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })),
        -1
      )
    );
  }, [a, b, c]);
  const sa = useAnimatedStyle(() => ({ opacity: a.value }));
  const sb = useAnimatedStyle(() => ({ opacity: b.value }));
  const sc = useAnimatedStyle(() => ({ opacity: c.value }));
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[sa, sb, sc].map((st, i) => (
        <Animated.View
          key={i}
          style={[
            { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
            st,
          ]}
        />
      ))}
    </View>
  );
}

export { FadeInDown, FadeInUp, FadeIn };
