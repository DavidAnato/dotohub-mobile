import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, StatusBar, View, Modal } from "react-native";
import { AppDialogHost, appAlert } from "./src/components/AppDialog";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as LocalAuthentication from "expo-local-authentication";
import * as SplashScreen from "expo-splash-screen";
import { C, brandNavy } from "./src/theme";
import { api, setSessionExpiredHandler } from "./src/api";
import { storage } from "./src/storage";
import { wipeClientCaches } from "./src/session";
import { persistOptions, queryClient } from "./src/queries/queryClient";
import { pingOnline, useAppStore } from "./src/store/appStore";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { PinLockScreen } from "./src/components/PinInput";
import { HospitalAttachGate } from "./src/components/HospitalAttachGate";
import { useHubRealtime } from "./src/hooks/useHubRealtime";
import { needsHospitalAttach } from "./src/constants";

SplashScreen.preventAutoHideAsync().catch(() => {});

async function hideSplash() {
  try {
    await SplashScreen.hideAsync();
  } catch {
    /* déjà masqué */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function BootView() {
  const pulse = useSharedValue(0.97);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.02, { duration: 900 }), withTiming(0.97, { duration: 900 })),
      -1,
      false
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={style}>
        <Image
          source={require("./assets/logo-splash.png")}
          style={{ width: 240, height: 64 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

function AppInner() {
  const phase = useAppStore((s) => s.phase);
  const dark = useAppStore((s) => s.dark);
  const user = useAppStore((s) => s.user);
  const locked = useAppStore((s) => s.locked);
  const needsPinSetup = useAppStore((s) => s.needsPinSetup);
  const setPhase = useAppStore((s) => s.setPhase);
  const setUser = useAppStore((s) => s.setUser);
  const setLocked = useAppStore((s) => s.setLocked);
  const setNeedsPinSetup = useAppStore((s) => s.setNeedsPinSetup);
  const enterMain = useAppStore((s) => s.enterMain);
  const hydrateTheme = useAppStore((s) => s.hydrateTheme);
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const pinBusyRef = useRef(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const wasBackground = useRef(false);

  useHubRealtime(phase === "main" && !locked && !needsPinSetup);

  /** Prompt biométrie. Auto-unlock au retour seulement si bio activée en stockage. */
  const promptBiometric = useCallback(async (): Promise<boolean> => {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hw && (await LocalAuthentication.isEnrolledAsync());
    if (!enrolled) return false;
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Déverrouiller DotoHub",
      cancelLabel: "Utiliser le PIN",
      disableDeviceFallback: true,
    });
    return !!res.success;
  }, []);

  const tryBiometricUnlock = useCallback(async (): Promise<boolean> => {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hw && (await LocalAuthentication.isEnrolledAsync());
    if (!enrolled) return false;
    const ok = await promptBiometric();
    if (ok) await storage.setBioEnabled(true);
    return ok;
  }, [promptBiometric]);

  useEffect(() => {
    hydrateTheme();
    LocalAuthentication.hasHardwareAsync()
      .then(async (hw) => {
        const enrolled = hw ? await LocalAuthentication.isEnrolledAsync() : false;
        setBioAvailable(hw && enrolled);
      })
      .catch(() => setBioAvailable(false));
  }, [hydrateTheme]);

  useEffect(() => {
    setSessionExpiredHandler((msg) => {
      void wipeClientCaches().then(() => {
        setPhase("login");
        appAlert("Session", msg);
      });
    });
    return () => setSessionExpiredHandler(null);
  }, [setPhase]);

  useEffect(() => {
    pingOnline();
    const id = setInterval(pingOnline, 15000);
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        pingOnline();
        if (wasBackground.current && phase === "main" && !needsPinSetup) {
          setLocked(true);
          setPinError("");
        }
        wasBackground.current = false;
      } else if (s === "background" || s === "inactive") {
        wasBackground.current = true;
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [phase, needsPinSetup, setLocked]);

  useEffect(() => {
    let cancelled = false;
    const failSafe = setTimeout(() => {
      if (cancelled) return;
      if (useAppStore.getState().phase === "boot") setPhase("login");
      void hideSplash();
    }, 8000);

    (async () => {
      try {
        const token = await storage.getAccess();
        if (token) {
          try {
            const me = await withTimeout(api.me(), 6000);
            if (me) {
              enterMain(me);
              return;
            }
          } catch {
            const cached = await storage.getUser();
            if (cached) {
              enterMain(cached);
              if (cached.pin_set) setLocked(true);
              return;
            }
          }
        }
        setPhase("login");
      } finally {
        clearTimeout(failSafe);
        await hideSplash();
        const st = useAppStore.getState();
        if (st.phase === "main" && st.user?.pin_set && !st.needsPinSetup) {
          const bioOk = await tryBiometricUnlock();
          if (!bioOk) setLocked(true);
          else setLocked(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [enterMain, setPhase, setLocked, tryBiometricUnlock]);

  useEffect(() => {
    if (phase !== "boot") {
      void hideSplash();
    }
  }, [phase]);

  const unlockWithPin = async (pin: string) => {
    if (pinBusyRef.current) return;
    pinBusyRef.current = true;
    setPinBusy(true);
    setPinError("");
    try {
      await api.verifyPin(pin);
      setLocked(false);
    } catch (e: any) {
      setPinError(e.message || "PIN incorrect.");
    } finally {
      pinBusyRef.current = false;
      setPinBusy(false);
    }
  };

  const setupPin = async (pin: string) => {
    if (pinBusyRef.current) return;
    pinBusyRef.current = true;
    setPinBusy(true);
    setPinError("");
    try {
      await api.setPin(pin);
      const next = user ? { ...user, pin_set: true } : null;
      if (next) {
        setUser(next);
        await storage.saveUser(next);
      }
      setNeedsPinSetup(false);
      setLocked(false);
      if (bioAvailable) {
        appAlert(
          "Biométrie",
          "Souhaitez-vous activer Face ID / empreinte pour déverrouiller plus vite ?",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Activer",
              onPress: async () => {
                const res = await LocalAuthentication.authenticateAsync({
                  promptMessage: "Activer la biométrie DotoHub",
                  cancelLabel: "Annuler",
                });
                if (res.success) await storage.setBioEnabled(true);
              },
            },
          ]
        );
      }
    } catch (e: any) {
      setPinError(e.message || "Impossible d'enregistrer le PIN.");
    } finally {
      pinBusyRef.current = false;
      setPinBusy(false);
    }
  };

  if (phase === "boot") {
    return <BootView />;
  }

  const showGate = phase === "main" && (needsPinSetup || locked);
  const showHospitalGate =
    phase === "main" && !showGate && needsHospitalAttach(user || undefined);

  return (
    <View style={{ flex: 1, backgroundColor: brandNavy }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={{ flex: 1, backgroundColor: dark ? "#0A0A0A" : C.bg }}>
        <RootNavigator />
        <AppDialogHost dark={dark} />
        <Modal visible={showGate} animationType="fade" presentationStyle="fullScreen">
          <SafeAreaView style={{ flex: 1, backgroundColor: dark ? "#0A0A0A" : "#F0F4F7" }} edges={["top", "bottom"]}>
            <PinLockScreen
              mode={needsPinSetup ? "setup" : "unlock"}
              title={needsPinSetup ? "Configurer le PIN" : "DotoHub verrouillé"}
              subtitle={
                needsPinSetup
                  ? "Code obligatoire pour sécuriser votre session professionnelle"
                  : "Entrez votre code PIN pour continuer"
              }
              dark={dark}
              error={pinError}
              loading={pinBusy}
              bioAvailable={!needsPinSetup && bioAvailable}
              onBio={
                needsPinSetup
                  ? undefined
                  : async () => {
                      if (pinBusyRef.current) return;
                      const ok = await promptBiometric();
                      if (ok) {
                        await storage.setBioEnabled(true);
                        setLocked(false);
                        setPinError("");
                      }
                    }
              }
              onSubmit={needsPinSetup ? setupPin : unlockWithPin}
            />
          </SafeAreaView>
        </Modal>
        <HospitalAttachGate
          visible={showHospitalGate}
          dark={dark}
          onDone={(u) => setUser(u)}
        />
      </View>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    const t = setTimeout(() => void hideSplash(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AppInner />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
