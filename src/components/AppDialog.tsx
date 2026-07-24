import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { brandNavy, C, darkC } from "../theme";
import { Button } from "../ui";

export type AppAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type DialogState = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

type ShowFn = (state: DialogState) => void;

let showImpl: ShowFn | null = null;
const queue: DialogState[] = [];

function flush() {
  if (!showImpl || queue.length === 0) return;
  showImpl(queue.shift()!);
}

/** Remplace Alert.alert — API compatible. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[]
) {
  const btns =
    buttons && buttons.length
      ? buttons
      : [{ text: "OK", style: "default" as const }];
  queue.push({ title, message, buttons: btns });
  flush();
}

export function appConfirm(
  title: string,
  message: string,
  confirmText = "Confirmer",
  destructive = false
): Promise<boolean> {
  return new Promise((resolve) => {
    appAlert(title, message, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Host global — monter une fois dans App. */
export function AppDialogHost({ dark = false }: { dark?: boolean }) {
  const [current, setCurrent] = useState<DialogState | null>(null);
  const colors = dark ? darkC : C;

  const close = useCallback(() => {
    setCurrent(null);
    setTimeout(flush, 220);
  }, []);

  useEffect(() => {
    showImpl = (state) => setCurrent(state);
    flush();
    return () => {
      showImpl = null;
    };
  }, []);

  const onPressBtn = (btn: AppAlertButton) => {
    close();
    setTimeout(() => btn.onPress?.(), 40);
  };

  if (!current) return null;

  const primary =
    current.buttons.find((b) => b.style !== "cancel") || current.buttons[0];
  const secondary = current.buttons.filter((b) => b !== primary);

  const titleColor = dark ? colors.text : brandNavy;
  const iconColor = dark ? C.teal : brandNavy;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          style={[styles.backdrop, dark && { backgroundColor: "rgba(0,0,0,0.72)" }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(220)}
          exiting={SlideOutDown.duration(160)}
          style={[
            styles.card,
            {
              backgroundColor: dark ? darkC.white : "#fff",
              borderColor: dark ? darkC.border : "#E5E7EB",
            },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: dark ? "#1C2A2E" : "#E8F2F5" },
            ]}
          >
            <Ionicons name="information-circle" size={28} color={iconColor} />
          </View>
          <Text style={[styles.title, { color: titleColor }]}>{current.title}</Text>
          {current.message ? (
            <Text style={[styles.message, { color: dark ? darkC.muted : "#64748B" }]}>
              {current.message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {secondary.map((b) => (
              <Button
                key={b.text}
                title={b.text}
                outline
                color={b.style === "destructive" ? C.emergency : dark ? C.teal : brandNavy}
                onPress={() => onPressBtn(b)}
              />
            ))}
            {primary ? (
              <Button
                title={primary.text}
                color={primary.style === "destructive" ? C.emergency : C.teal}
                onPress={() => onPressBtn(primary)}
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  actions: { gap: 10 },
});
