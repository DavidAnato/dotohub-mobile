import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Field } from "../ui";
import { C, ProUser, darkC } from "../theme";
import { useLoginMutation } from "../queries/hooks";
import { CardDecor, ScreenEnter, StaggerItem } from "../motion";
import Register from "./Register";

export default function Login({
  onLogin,
  dark = false,
}: {
  onLogin: (u: ProUser) => void;
  dark?: boolean;
}) {
  const colors = dark ? darkC : C;
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
    ? ([colors.bg, "#162032", colors.white] as const)
    : (["#E8F2F5", "#F1F5F9", "#FFFFFF"] as const);

  if (mode === "register") {
    return <Register dark={dark} onDone={onLogin} onBack={() => setMode("login")} />;
  }

  return (
    <LinearGradient colors={[...grad]} style={{ flex: 1 }}>
      <ScreenEnter>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, paddingBottom: 24, gap: 16 }}>
          <StaggerItem index={0}>
            <View style={{ alignItems: "center", marginBottom: 28 }}>
              <Image
                source={require("../../assets/logo-dotohub.png")}
                style={{ width: 220, height: 52 }}
                resizeMode="contain"
              />
              <Text style={{ color: colors.muted, marginTop: 12, textAlign: "center", fontSize: 14 }}>
                Espace professionnels de santé
              </Text>
            </View>
          </StaggerItem>

          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#1E3755",
              shadowOpacity: 0.07,
              shadowRadius: 14,
              elevation: 2,
              overflow: "hidden",
            }}
          >
            <CardDecor variant="calm" dark={dark} />
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
                <Text style={{ color: C.emergency, fontWeight: "700", marginBottom: 12 }}>{error}</Text>
              ) : null}
              <Button
                title="Se connecter"
                onPress={submit}
                loading={loginMut.isPending}
                color={C.navy}
              />
          </View>

          <Pressable onPress={() => setMode("register")} style={{ marginTop: 8 }}>
            <Text style={{ textAlign: "center", color: C.teal, fontWeight: "800", fontSize: 14 }}>
              Créer un compte professionnel
            </Text>
          </Pressable>

          <Text
            style={{
              textAlign: "center",
              color: colors.grey,
              fontSize: 12,
              marginTop: 24,
              lineHeight: 18,
            }}
          >
            Ex. medecin / Medecin123! · ambulancier / Ambulancier123!{"\n"}
            Connexion : identifiant + mot de passe (sans OTP)
          </Text>
        </ScrollView>
      </ScreenEnter>
    </LinearGradient>
  );
}
