import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, brandBlue, brandNavy, darkC } from "../theme";

export const PIN_LEN = 5;
const DEFAULT_PIN_LEN = PIN_LEN;

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (pin: string) => void;
  error?: boolean;
  dark?: boolean;
  autoFocus?: boolean;
  secure?: boolean;
  label?: string;
  disabled?: boolean;
  /** Affiche un loader centré et grise les cases (ex. vérif OTP) */
  loading?: boolean;
  /** Longueur (5 = PIN, 6 = OTP SMS) */
  length?: number;
};

/**
 * Saisie chiffres premium — cases, autofocus, shake sur erreur.
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  error = false,
  dark = false,
  autoFocus = true,
  secure = true,
  label,
  disabled = false,
  loading = false,
  length = DEFAULT_PIN_LEN,
}: Props) {
  const colors = dark ? darkC : C;
  const inputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const locked = disabled || loading;

  const focusInput = () => {
    if (locked) return;
    // Double focus : Android / Modal Expo Go ignore souvent le 1er appel
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (autoFocus && !locked) {
      const delay = Platform.OS === "android" ? 450 : 280;
      const t = setTimeout(focusInput, delay);
      return () => clearTimeout(t);
    }
  }, [autoFocus, locked]);

  useEffect(() => {
    if (locked) {
      inputRef.current?.blur();
      setFocused(false);
    }
  }, [locked]);

  // Re-focus après reset (PIN incorrect)
  useEffect(() => {
    if (!locked && autoFocus && value.replace(/\D/g, "").length === 0) {
      const t = setTimeout(focusInput, 120);
      return () => clearTimeout(t);
    }
  }, [value, locked, autoFocus]);

  useEffect(() => {
    if (!error) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  const digits = value.replace(/\D/g, "").slice(0, length);

  const handleChange = (raw: string) => {
    if (locked) return;
    const next = raw.replace(/\D/g, "").slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const boxBg = locked
    ? dark
      ? "#141414"
      : "#EEF1F4"
    : dark
      ? "#1A1A1A"
      : "#F8FAFB";
  const digitColor = locked
    ? dark
      ? "#6B7280"
      : "#94A3B8"
    : error
      ? C.emergency
      : colors.text;

  return (
    <View style={{ gap: 12 }}>
      {label ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
          {label}
        </Text>
      ) : null}
      <View style={styles.pinWrap}>
        <Animated.View
          style={[
            styles.row,
            { transform: [{ translateX: shake }], opacity: locked ? 0.72 : 1 },
          ]}
        >
          {Array.from({ length }).map((_, i) => {
            const filled = i < digits.length;
            const active = !locked && focused && i === digits.length;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    width: length > 5 ? 44 : 52,
                    height: length > 5 ? 54 : 60,
                    backgroundColor: boxBg,
                    borderColor: error
                      ? C.emergency
                      : active
                        ? brandBlue
                        : locked
                          ? dark
                            ? "#2A2A2A"
                            : "#D0D7DE"
                          : filled
                            ? brandNavy
                            : colors.border,
                    borderWidth: active || error ? 2 : 1.5,
                    shadowOpacity: active ? 0.12 : 0,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: secure && filled ? 20 : 22,
                    fontWeight: "700",
                    color: digitColor,
                    letterSpacing: 1,
                  }}
                >
                  {filled ? (secure ? "●" : digits[i]) : ""}
                </Text>
              </View>
            );
          })}
        </Animated.View>
        {!locked ? (
          <TextInput
            ref={inputRef}
            value={digits}
            onChangeText={handleChange}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={length}
            caretHidden
            contextMenuHidden
            autoFocus={false}
            editable
            showSoftInputOnFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.inputOverlay}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            importantForAutofill="no"
            underlineColorAndroid="transparent"
            accessibilityLabel={label || `Code à ${length} chiffres`}
            accessibilityState={{ disabled: locked, busy: loading }}
          />
        ) : null}
        {locked ? (
          <Pressable style={StyleSheet.absoluteFillObject} disabled />
        ) : null}
        {loading ? (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <View
              style={[
                styles.loaderBadge,
                {
                  backgroundColor: dark ? "rgba(26,26,26,0.92)" : "rgba(255,255,255,0.94)",
                  borderColor: dark ? "#2A2A2A" : colors.border,
                },
              ]}
            >
              <ActivityIndicator size="small" color={brandBlue} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type LockProps = {
  title?: string;
  subtitle?: string;
  dark?: boolean;
  error?: string;
  loading?: boolean;
  bioAvailable?: boolean;
  onBio?: () => void;
  onSubmit: (pin: string) => void;
  onUrgence?: () => void;
  urgenceLabel?: string;
  mode?: "unlock" | "setup" | "confirm";
  confirmHint?: string;
};

/** Écran / overlay de verrouillage ou configuration PIN. */
export function PinLockScreen({
  title = "Déverrouiller",
  subtitle = "Saisissez votre code PIN",
  dark = false,
  error,
  loading,
  bioAvailable,
  onBio,
  onSubmit,
  onUrgence,
  urgenceLabel = "Accéder à Urgence",
  mode = "unlock",
}: LockProps) {
  const colors = dark ? darkC : C;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"pin" | "confirm">(mode === "confirm" ? "confirm" : "pin");
  const [localErr, setLocalErr] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!loading) submittingRef.current = false;
  }, [loading]);

  useEffect(() => {
    if (error) {
      setPin("");
      setConfirm("");
      setStep(mode === "setup" ? "pin" : "pin");
      submittingRef.current = false;
    }
  }, [error, mode]);

  const handleComplete = (v: string) => {
    if (loading || submittingRef.current) return;
    setLocalErr("");
    if (mode === "setup") {
      if (step === "pin") {
        setPin(v);
        setStep("confirm");
        setConfirm("");
        return;
      }
      if (v !== pin) {
        setLocalErr("Les codes ne correspondent pas.");
        setConfirm("");
        setStep("pin");
        setPin("");
        return;
      }
      submittingRef.current = true;
      onSubmit(v);
      return;
    }
    submittingRef.current = true;
    onSubmit(v);
  };

  const displayErr = localErr || error || "";
  const currentValue = mode === "setup" && step === "confirm" ? confirm : pin;
  const currentOnChange = mode === "setup" && step === "confirm" ? setConfirm : setPin;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: dark ? "#0A0A0A" : "#F0F4F7",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: dark ? "#1A1A1A" : C.lightBlue,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons
          name={mode === "setup" ? "key-outline" : "lock-closed-outline"}
          size={28}
          color={brandBlue}
        />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: "800",
          letterSpacing: -0.3,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          marginTop: 8,
          marginBottom: 28,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {mode === "setup" && step === "confirm"
          ? "Confirmez votre code PIN"
          : subtitle}
      </Text>

      <PinInput
        key={`${mode}-${step}-${displayErr ? "err" : "ok"}`}
        value={currentValue}
        onChange={currentOnChange}
        onComplete={handleComplete}
        error={!!displayErr}
        dark={dark}
        disabled={!!loading}
        loading={!!loading}
        label={`${DEFAULT_PIN_LEN} chiffres`}
      />

      {displayErr ? (
        <Text
          style={{
            color: C.emergency,
            fontWeight: "600",
            marginTop: 16,
            textAlign: "center",
            fontSize: 13,
          }}
        >
          {displayErr}
        </Text>
      ) : null}

      {bioAvailable && onBio && mode === "unlock" ? (
        <Pressable
          onPress={onBio}
          disabled={!!loading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 28,
            paddingVertical: 12,
            paddingHorizontal: 18,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Ionicons name="finger-print" size={22} color={brandBlue} />
          <Text style={{ color: brandBlue, fontWeight: "700", fontSize: 15 }}>
            Utiliser la biométrie
          </Text>
        </Pressable>
      ) : null}

      {onUrgence ? (
        <Pressable
          onPress={onUrgence}
          style={{
            marginTop: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: dark ? "#2A1212" : C.redSoft,
          }}
        >
          <Ionicons name="medkit-outline" size={18} color={C.emergency} />
          <Text style={{ color: C.emergency, fontWeight: "700", fontSize: 14 }}>
            {urgenceLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const PIN_LENGTH = PIN_LEN;

const styles = StyleSheet.create({
  pinWrap: {
    position: "relative",
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  box: {
    width: 52,
    height: 60,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: brandNavy,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** Couvre les cases — opacity > 0 obligatoire pour le clavier Android */
  inputOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    opacity: 0.02,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    letterSpacing: 0,
    padding: 0,
    margin: 0,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  loaderBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: brandNavy,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
