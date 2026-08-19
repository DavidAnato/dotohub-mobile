import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthScreenHeader, Button, Field } from "../ui";
import { C, ProUser, accent, brandNavy, darkC } from "../theme";
import { useLoginMutation } from "../queries/hooks";
import { ScreenEnter, StaggerItem } from "../motion";
import { useScreenInsets } from "../safeArea";
import Register from "./Register";

export default function Login({
  onLogin,
  dark = false,
}: {
  onLogin: (u: ProUser) => void;
  dark?: boolean;
}) {
  const colors = dark ? darkC : C;
  const { scrollBottom } = useScreenInsets();
  const [username, setUsername] = useState("medecin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const loginMut = useLoginMutation();

  const submit = async () => {
    if (!username || !password) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setError("");
    try {
      onLogin(await loginMut.mutateAsync({ username: username.trim(), password }));
    } catch (e: any) {
      setError(e.message || "Connexion impossible.");
    }
  };

  const grad = dark
    ? ([colors.bg, "#121212", colors.white] as const)
    : (["#F4FBFC", "#F7FAFB", "#FFFFFF"] as const);

  if (mode === "register") {
    return <Register dark={dark} onDone={onLogin} onBack={() => setMode("login")} />;
  }

  return (
    <LinearGradient colors={[...grad]} style={{ flex: 1 }}>
      <ScreenEnter>
        <ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottom, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <AuthScreenHeader
            colors={colors}
            title="Connexion"
            subtitle="Espace professionnels de santé"
            brand={
              <Image
                source={require("../../assets/logo-dotohub.png")}
                style={{ width: 180, height: 42, marginBottom: 18 }}
                resizeMode="contain"
              />
            }
          />

          <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
            <StaggerItem index={0}>
              <Field
                label="Identifiant"
                value={username}
                onChangeText={setUsername}
                placeholder="medecin"
                colors={colors}
              />
              <Field
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                colors={colors}
              />
              {error ? (
                <Text style={{ color: C.emergency, fontWeight: "600", marginBottom: 14 }}>{error}</Text>
              ) : null}
              <Button
                title="Se connecter"
                onPress={submit}
                loading={loginMut.isPending}
                color={dark ? accent : brandNavy}
              />
            </StaggerItem>

            <Pressable onPress={() => setMode("register")} style={{ marginTop: 22 }}>
              <Text style={{ textAlign: "center", color: colors.muted, fontSize: 14 }}>
                Nouveau professionnel ?{" "}
                <Text style={{ color: accent, fontWeight: "700" }}>Créer un compte</Text>
              </Text>
            </Pressable>

            <Text
              style={{
                textAlign: "center",
                color: colors.grey,
                fontSize: 12,
                marginTop: 28,
                lineHeight: 18,
              }}
            >
              Ex. medecin / Medecin123! · ambulancier / Ambulancier123!
            </Text>
          </View>
        </ScrollView>
      </ScreenEnter>
    </LinearGradient>
  );
}
