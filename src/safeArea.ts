import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Insets globaux : status bar, gesture pill Android, home indicator iOS. */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0);
  const bottom = Math.max(insets.bottom, 0);
  return {
    top,
    bottom,
    left: insets.left,
    right: insets.right,
    headerPad: top + 8,
    tabBarPad: Math.max(bottom, 8),
    scrollBottom: Math.max(bottom, 12) + 28,
  };
}
