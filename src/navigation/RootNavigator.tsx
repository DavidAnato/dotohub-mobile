import React, { useCallback, useEffect, useRef } from "react";
import { BackHandler, Platform, Text, View } from "react-native";
import { appAlert } from "../components/AppDialog";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { C, brandNavy, darkC, roleHasAgendaTab } from "../theme";
import { api } from "../api";
import { logoutFully } from "../session";
import { useAppStore } from "../store/appStore";
import { useConsentWait, type ConsentOutcome } from "../hooks/useConsentWait";
import Login from "../screens/Login";
import Home from "../screens/Home";
import Recherche from "../screens/Recherche";
import Scan from "../screens/Scan";
import PatientDossier from "../screens/Patient";
import Settings from "../screens/Settings";
import Agenda from "../screens/Agenda";
import PharmaFile from "../screens/PharmaFile";
import LaboFile from "../screens/LaboFile";
import Tournee from "../screens/Tournee";
import NouveauPatient from "../screens/NouveauPatient";
import UrgencePro from "../screens/UrgencePro";
import { ConsentWaitingView } from "../components/ConsentWaiting";
import { BrandBackground } from "../motion";
import { Header } from "../ui";
import type { MainTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

type ConsentProps = NativeStackScreenProps<RootStackParamList, "ConsentWaiting">;

/** Sur l'onglet racine : confirmer avant de quitter (Android). */
function useAndroidExitConfirm(appName: string) {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const onBack = () => {
        const parent = navigation.getParent();
        if (parent?.canGoBack()) return false;
        appAlert(`Quitter ${appName}`, "Fermer l'application ?", [
          { text: "Annuler", style: "cancel" },
          { text: "Quitter", style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [navigation, appName])
  );
}

function OfflineBanner() {
  const online = useAppStore((s) => s.online);
  const dark = useAppStore((s) => s.dark);
  const colors = dark ? darkC : C;
  if (online) return null;
  return (
    <View
      style={{
        backgroundColor: colors.amberSoft,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.amber} />
      <Text style={{ color: colors.amber, fontWeight: "700", fontSize: 12, flex: 1 }}>
        Hors ligne — cache patients / dossiers
      </Text>
    </View>
  );
}

function ConsentWaitingScreen({ route, navigation }: ConsentProps) {
  const dark = useAppStore((s) => s.dark);
  const setPendingConsent = useAppStore((s) => s.setPendingConsent);
  const { name, npi, patientId, accessRequestId } = route.params;
  const colors = dark ? darkC : C;
  const handledRef = useRef(false);

  useEffect(() => {
    setPendingConsent({
      patientId,
      npi,
      name,
      accessRequestId,
    });
    return () => setPendingConsent(null);
  }, [patientId, npi, name, accessRequestId, setPendingConsent]);

  const onConsentOutcome = useCallback(
    (outcome: ConsentOutcome) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setPendingConsent(null);

      if (outcome.kind === "granted") {
        navigation.replace("Patient", { patientId: outcome.patientId });
        return;
      }

      const messages: Record<Exclude<ConsentOutcome["kind"], "granted">, string> = {
        denied: "Le patient a refusé l'accès au dossier.",
        cancelled: "La demande d'accès a été annulée.",
        expired: "La demande d'accès a expiré.",
      };
      appAlert("Consentement", messages[outcome.kind], [
        {
          text: "OK",
          onPress: () => {
            if (navigation.canGoBack()) navigation.goBack();
          },
        },
      ]);
    },
    [navigation, setPendingConsent]
  );

  useConsentWait(
    true,
    { patientId, accessRequestId },
    onConsentOutcome
  );

  return (
    <BrandBackground dark={dark}>
      <Header
        title="Consentement"
        subtitle={npi}
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />
      <ConsentWaitingView
        patientName={name}
        dark={dark}
        onCancel={async () => {
          handledRef.current = true;
          if (accessRequestId) {
            try {
              await api.cancelAccessRequest(accessRequestId);
            } catch {
              /* navigation anyway */
            }
          }
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />
      <Text
        style={{
          color: colors.muted,
          textAlign: "center",
          paddingHorizontal: 24,
          paddingBottom: 24,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        Le bouton retour Android annule aussi l'attente.
      </Text>
    </BrandBackground>
  );
}

const STACK_FROM_HOME = new Set([
  "PharmaFile",
  "LaboFile",
  "Tournee",
  "NouveauPatient",
  "UrgencePro",
]);

function HomeTabScreen() {
  useAndroidExitConfirm("DotoHub");
  const dark = useAppStore((s) => s.dark);
  const user = useAppStore((s) => s.user);
  const navigation = useNavigation<any>();

  if (!user) return null;

  return (
    <Home
      user={user}
      dark={dark}
      onOpenPatient={(id) => navigation.getParent()?.navigate("Patient", { patientId: id })}
      onNavigate={(t) => {
        if (t === "scan") navigation.navigate("Scan");
        else if (t === "recherche") navigation.navigate("Recherche");
        else if (t === "agenda") navigation.navigate("Agenda");
        else if (t === "parametres") navigation.navigate("Parametres");
        else if (STACK_FROM_HOME.has(t)) navigation.getParent()?.navigate(t);
      }}
    />
  );
}

function MainTabs() {
  const dark = useAppStore((s) => s.dark);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setPhase = useAppStore((s) => s.setPhase);
  const toggleDark = useAppStore((s) => s.toggleDark);
  const colors = dark ? darkC : C;
  const showAgendaTab = roleHasAgendaTab(user?.role);

  if (!user) {
    return (
      <BrandBackground dark={!!dark}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Session expirée…</Text>
        </View>
      </BrandBackground>
    );
  }

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 58,
          elevation: 8,
          shadowColor: brandNavy,
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarIcon: ({ color, focused, size }) => {
          let name: keyof typeof Ionicons.glyphMap = "home-outline";
          if (route.name === "Home") name = focused ? "home" : "home-outline";
          else if (route.name === "Recherche") name = focused ? "search" : "search-outline";
          else if (route.name === "Scan") name = "qr-code-outline";
          else if (route.name === "Agenda") name = focused ? "calendar" : "calendar-outline";
          else if (route.name === "Parametres") name = focused ? "settings" : "settings-outline";
          return <Ionicons name={name} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} options={{ title: "Accueil" }} />
      <Tab.Screen name="Recherche" options={{ title: "Recherche" }}>
        {({ navigation }) => (
          <Recherche
            dark={dark}
            onOpenPatient={(id) => navigation.getParent()?.navigate("Patient", { patientId: id })}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Scan" options={{ title: "Scan" }}>
        {({ navigation }) => (
          <Scan
            dark={dark}
            onScanned={(id, _npi, meta) => {
              const goUrgence =
                user.role === "ambulancier" || !!meta?.emergency;
              if (goUrgence) {
                navigation.getParent()?.navigate("UrgencePro", {
                  patientId: id,
                });
              } else {
                navigation.getParent()?.navigate("Patient", { patientId: id });
              }
            }}
            onPendingConsent={(info) => {
              navigation.getParent()?.navigate("ConsentWaiting", info);
            }}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Agenda"
        options={{
          title: "Agenda",
          /** Masqué pour pharmacien / laborantin / ambulancier. */
          tabBarButton: showAgendaTab ? undefined : () => null,
          tabBarItemStyle: showAgendaTab ? undefined : { display: "none" },
        }}
      >
        {() => <Agenda user={user} dark={dark} />}
      </Tab.Screen>
      <Tab.Screen name="Parametres" options={{ title: "Réglages" }}>
        {() => (
          <Settings
            user={user}
            dark={dark}
            onToggleDark={toggleDark}
            onUserUpdate={setUser}
            onLogout={async () => {
              await logoutFully();
              setPhase("login");
            }}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MainNavigator() {
  const dark = useAppStore((s) => s.dark);
  const user = useAppStore((s) => s.user);
  const colors = dark ? darkC : C;

  if (!user) {
    return (
      <BrandBackground dark={!!dark}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Chargement de la session…</Text>
        </View>
      </BrandBackground>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <RootStack.Screen name="MainTabs" component={MainTabs} />
        <RootStack.Screen name="Patient">
          {({ route, navigation }) => (
            <PatientDossier
              patientId={route.params.patientId}
              user={user}
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="ConsentWaiting" component={ConsentWaitingScreen} />
        <RootStack.Screen name="PharmaFile">
          {({ navigation }) => (
            <PharmaFile
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="LaboFile">
          {({ navigation }) => (
            <LaboFile
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="Tournee">
          {({ navigation }) => (
            <Tournee
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="NouveauPatient">
          {({ navigation }) => (
            <NouveauPatient
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
              onSaved={(id) => navigation.replace("Patient", { patientId: id })}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="UrgencePro">
          {({ route, navigation }) => (
            <UrgencePro
              patientId={route.params?.patientId}
              dark={dark}
              onBack={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
            />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    </View>
  );
}

function LoginOnly() {
  const dark = useAppStore((s) => s.dark);
  const enterMain = useAppStore((s) => s.enterMain);
  return <Login dark={dark} onLogin={enterMain} />;
}

export function RootNavigator() {
  const phase = useAppStore((s) => s.phase);
  const user = useAppStore((s) => s.user);
  const dark = useAppStore((s) => s.dark);

  const navTheme = dark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: darkC.bg,
          card: darkC.white,
          text: darkC.text,
          border: darkC.border,
          primary: C.teal,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: C.bg,
          card: C.white,
          text: C.text,
          border: C.border,
          primary: C.teal,
        },
      };

  if (phase === "login" || !user) {
    return (
      <NavigationContainer theme={navTheme}>
        <LoginOnly />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <MainNavigator />
    </NavigationContainer>
  );
}
