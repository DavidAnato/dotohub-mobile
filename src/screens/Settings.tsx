import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { appAlert } from "../components/AppDialog";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { C, darkC, ProUser } from "../theme";
import { Button, Field, Header, PhoneField } from "../ui";
import {
  BrandBackground,
  IconBadge,
  PressScale,
  ScreenEnter,
  StaggerItem,
  hapticSuccess,
} from "../motion";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { toE164Bj } from "../phone";
import { qk } from "../queries/keys";

type Panel = "compte" | "photo" | "structure" | "apparence" | "a-propos" | "admin" | null;

function SettingsRow({
  icon,
  label,
  subtitle,
  colors,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  colors: typeof C;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: colors.white,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: danger ? C.emergency + "44" : colors.border,
        minHeight: 64,
      }}
    >
      <IconBadge
        name={icon}
        color={danger ? C.emergency : C.teal}
        bg={danger ? colors.emergencySoft : colors.lightTeal}
        size={40}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: danger ? C.emergency : colors.text,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressScale>
  );
}

function SettingsModal({
  visible,
  title,
  icon,
  colors,
  dark,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: typeof C;
  dark: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{
            ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
            backgroundColor: "rgba(0, 0, 0, 0.65)",
          }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingTop: 10,
              paddingBottom: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <IconBadge name={icon} color={C.teal} bg={dark ? colors.lightTeal : C.lightTeal} size={40} />
            <Text style={{ flex: 1, color: colors.text, fontWeight: "800", fontSize: 17 }}>
              {title}
            </Text>
            <PressScale onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </PressScale>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Settings({
  user,
  dark,
  onToggleDark,
  onLogout,
  onUserUpdate,
}: {
  user: ProUser;
  dark: boolean;
  onToggleDark: () => void;
  onLogout: () => void;
  onUserUpdate?: (u: ProUser) => void;
}) {
  const colors = dark ? darkC : C;
  const [panel, setPanel] = useState<Panel>(null);
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.telephone || "");
  const [email, setEmail] = useState(user.email || "");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPhotoUrl(user.photo_url || null);
  }, [user.photo_url]);

  const shownPhoto = preview || photoUrl;

  const structures = (user as ProUser & { structures?: { nom: string }[] }).structures || [];
  const structureLabel = useMemo(() => {
    if (structures.length) return structures.map((s) => s.nom).join(", ");
    return "Non liée";
  }, [structures]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const updated = await api.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        telephone: toE164Bj(phone) || phone.trim(),
        email: email.trim(),
      });
      onUserUpdate?.(updated);
      setMsg("Profil mis à jour.");
      hapticSuccess();
    } catch (e: any) {
      setMsg(e.message || "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appAlert("Permission", "Autorisez l'accès à la galerie pour la photo d'identité.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setPreview(asset.uri);
    setBusy(true);
    try {
      const updated = await api.uploadPhoto(
        asset.uri,
        asset.mimeType || "image/jpeg",
        asset.fileName || "identite.jpg"
      );
      setPhotoUrl(updated.photo_url || asset.uri);
      setPreview(null);
      onUserUpdate?.(updated);
      hapticSuccess();
      setMsg("Photo d'identité enregistrée.");
    } catch (e: any) {
      setPreview(null);
      appAlert("Photo", e.message || "Upload impossible.");
    } finally {
      setBusy(false);
    }
  };

  const openPhoto = () => {
    setMsg("");
    setPanel("photo");
  };

  const { refreshControl } = usePullRefresh({
    keys: [qk.me, qk.dashboard],
    refetch: [
      async () => {
        const me = await api.me();
        if (me) {
          onUserUpdate?.(me);
          setFirstName(me.first_name || "");
          setLastName(me.last_name || "");
          setPhone(me.telephone || "");
          setEmail(me.email || "");
          setPhotoUrl(me.photo_url || null);
        }
      },
    ],
  });

  return (
    <BrandBackground dark={dark}>
      <ScreenEnter>
        <Header title="Paramètres" subtitle="Réglages du compte" />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={refreshControl}
        >
          <StaggerItem index={0}>
            <PressScale onPress={openPhoto}>
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <Avatar uri={shownPhoto} name={user.full_name} size={96} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18, marginTop: 4 }}>
                  {user.full_name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {user.role_label} · @{user.username}
                </Text>
                {!photoUrl ? (
                  <View
                    style={{
                      marginTop: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: colors.lightTeal,
                    }}
                  >
                    <Text style={{ color: C.teal, fontSize: 11, fontWeight: "700" }}>
                      Photo à ajouter — toucher pour gérer
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Toucher pour changer la photo d&apos;identité
                  </Text>
                )}
              </View>
            </PressScale>
          </StaggerItem>

          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.6,
              marginTop: 8,
              marginBottom: 2,
              marginLeft: 4,
            }}
          >
            COMPTE
          </Text>

          <StaggerItem index={1}>
            <SettingsRow
              icon="person-outline"
              label="Compte"
              subtitle="Nom, téléphone, e-mail"
              colors={colors}
              onPress={() => {
                setMsg("");
                setPanel("compte");
              }}
            />
          </StaggerItem>
          <StaggerItem index={2}>
            <SettingsRow
              icon="camera-outline"
              label="Photo d'identité"
              subtitle={photoUrl ? "Photo enregistrée" : "Visage centré, obligatoire"}
              colors={colors}
              onPress={openPhoto}
            />
          </StaggerItem>
          <StaggerItem index={3}>
            <SettingsRow
              icon="business-outline"
              label="Structure & rôle"
              subtitle={`${structureLabel} · ${user.role_label}`}
              colors={colors}
              onPress={() => setPanel("structure")}
            />
          </StaggerItem>

          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.6,
              marginTop: 12,
              marginBottom: 2,
              marginLeft: 4,
            }}
          >
            PRÉFÉRENCES
          </Text>

          <StaggerItem index={4}>
            <SettingsRow
              icon={dark ? "moon" : "sunny-outline"}
              label="Apparence"
              subtitle={dark ? "Mode sombre" : "Mode clair"}
              colors={colors}
              onPress={() => setPanel("apparence")}
            />
          </StaggerItem>
          <StaggerItem index={5}>
            <SettingsRow
              icon="information-circle-outline"
              label="À propos"
              subtitle="DotoHub · DOTO+"
              colors={colors}
              onPress={() => setPanel("a-propos")}
            />
          </StaggerItem>

          {user.role === "admin" ? (
            <>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  marginTop: 12,
                  marginBottom: 2,
                  marginLeft: 4,
                }}
              >
                ADMIN
              </Text>
              <StaggerItem index={6}>
                <SettingsRow
                  icon="shield-checkmark-outline"
                  label="Administration"
                  subtitle="Structure, DotoCards (web)"
                  colors={colors}
                  onPress={() => setPanel("admin")}
                />
              </StaggerItem>
            </>
          ) : null}

          <StaggerItem index={user.role === "admin" ? 7 : 6}>
            <View style={{ marginTop: 12 }}>
              <SettingsRow
                icon="log-out-outline"
                label="Déconnexion"
                colors={colors}
                danger
                onPress={onLogout}
              />
            </View>
          </StaggerItem>
        </ScrollView>

        <SettingsModal
          visible={panel === "compte"}
          title="Compte"
          icon="person-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <Field label="Prénom" value={firstName} onChangeText={setFirstName} colors={colors} />
          <Field label="Nom" value={lastName} onChangeText={setLastName} colors={colors} />
          <PhoneField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            colors={colors}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            colors={colors}
          />
          {msg ? (
            <Text
              style={{
                color: msg.includes("impossible") ? C.emergency : C.teal,
                fontWeight: "700",
              }}
            >
              {msg}
            </Text>
          ) : null}
          <Button title="Enregistrer" onPress={save} loading={busy} color={C.navy} />
        </SettingsModal>

        <SettingsModal
          visible={panel === "photo"}
          title="Photo d'identité"
          icon="camera-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <View style={{ alignItems: "center", gap: 14, paddingVertical: 8 }}>
            <View
              style={{
                padding: 4,
                borderRadius: 64,
                borderWidth: 2,
                borderColor: C.teal,
                borderStyle: "dashed",
              }}
            >
              <Avatar uri={shownPhoto} name={user.full_name} size={128} />
            </View>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                textAlign: "center",
                lineHeight: 19,
                paddingHorizontal: 8,
              }}
            >
              Cadrez votre visage au centre. JPEG, PNG ou WebP — type photo d&apos;identité.
            </Text>
            <Button
              title={shownPhoto ? "Changer la photo" : "Ajouter une photo"}
              icon="camera-outline"
              outline
              color={C.teal}
              loading={busy}
              onPress={pickPhoto}
            />
            {msg && msg.includes("Photo") ? (
              <Text style={{ color: C.teal, fontWeight: "700" }}>{msg}</Text>
            ) : null}
          </View>
        </SettingsModal>

        <SettingsModal
          visible={panel === "structure"}
          title="Structure & rôle"
          icon="business-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                RÔLE
              </Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                {user.role_label}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Attribué par l&apos;administration — non modifiable
              </Text>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
              }}
            />
            <View>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                STRUCTURE
              </Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                {structureLabel}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Liée à votre compte professionnel
              </Text>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                IDENTIFIANT
              </Text>
              <Text style={{ color: colors.text, fontWeight: "600" }}>@{user.username}</Text>
            </View>
          </View>
        </SettingsModal>

        <SettingsModal
          visible={panel === "apparence"}
          title="Apparence"
          icon="color-palette-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <PressScale
            onPress={onToggleDark}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <IconBadge name={dark ? "moon" : "sunny-outline"} color={C.teal} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Mode sombre</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Réduit la luminosité de l&apos;interface
              </Text>
            </View>
            <Switch
              value={dark}
              onValueChange={onToggleDark}
              trackColor={{ true: C.teal }}
            />
          </PressScale>
        </SettingsModal>

        <SettingsModal
          visible={panel === "a-propos"}
          title="À propos"
          icon="information-circle-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>DotoHub</Text>
          <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 6 }}>
            Application professionnelle de la plateforme DOTO+. Accès sécurisé aux dossiers
            patients avec consentement et journal d&apos;audit.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>Version 1.0</Text>
        </SettingsModal>

        <SettingsModal
          visible={panel === "admin"}
          title="Administration"
          icon="shield-checkmark-outline"
          colors={colors}
          dark={dark}
          onClose={() => setPanel(null)}
        >
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                Admin structure
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 6 }}>
                Vous gérez la structure, les accès métier et le dossier patient (consultations,
                ordonnances, constantes, RDV) selon les droits serveur.
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                DotoCards
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 6 }}>
                La gestion des cartes QR (émission, révocation, réémission) se fait sur le hub
                web DotoHub — menu DotoCards. Cette app mobile n&apos;inclut pas d&apos;écran
                admin dédié pour l&apos;instant.
              </Text>
            </View>
          </View>
        </SettingsModal>
      </ScreenEnter>
    </BrandBackground>
  );
}
