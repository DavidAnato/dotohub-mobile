import React from "react";
import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  C,
  ProUser,
  darkC,
  onBrand,
  roleHasAgendaTab,
  roleHomeCtas,
  type RoleNavCta,
  type RoleNavStackScreen,
} from "../theme";
import { useHubDashboard } from "../queries/hooks";
import { qk } from "../queries/keys";
import { Card, Header } from "../ui";
import {
  BrandBackground,
  EmptyState,
  HomeSkeleton,
  IconBadge,
  PressScale,
  ScreenEnter,
  StaggerItem,
} from "../motion";
import { Avatar } from "../components/Avatar";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { api } from "../api";
import { useAppStore } from "../store/appStore";

export type HomeNavTarget =
  | "recherche"
  | "scan"
  | "agenda"
  | "parametres"
  | RoleNavStackScreen;

function RoleCtaTile({
  cta,
  onPress,
}: {
  cta: RoleNavCta;
  onPress: () => void;
}) {
  const colors = cta.emphasis
    ? ([C.emergency, "#7F1D1D"] as const)
    : (["#1E3755", "#3E8295"] as const);

  return (
    <PressScale onPress={onPress} style={{ borderRadius: 18, overflow: "hidden" }}>
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 16,
          borderRadius: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          minHeight: cta.emphasis ? 104 : undefined,
          borderWidth: cta.emphasis ? 2 : 0,
          borderColor: cta.emphasis ? "rgba(255,255,255,0.35)" : "transparent",
        }}
      >
        <IconBadge name={cta.icon as any} color={onBrand} bg="rgba(255,255,255,0.18)" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: onBrand, fontWeight: "800", fontSize: cta.emphasis ? 18 : 16 }}>
            {cta.title}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
            {cta.subtitle}
          </Text>
        </View>
      </LinearGradient>
    </PressScale>
  );
}

export default function Home({
  user,
  dark,
  onOpenPatient,
  onNavigate,
}: {
  user: ProUser;
  dark?: boolean;
  onOpenPatient: (id: number) => void;
  onNavigate: (target: HomeNavTarget) => void;
}) {
  const colors = dark ? darkC : C;
  const { data: dash, error, isLoading, refetch } = useHubDashboard(true);
  const setUser = useAppStore((s) => s.setUser);
  const stats = dash?.stats || {};
  const errMsg = error ? (error as Error).message || "Hors ligne" : "";
  const showSkeleton = isLoading && !dash;
  const showAgenda = roleHasAgendaTab(user.role);
  const roleCtas = roleHomeCtas(user.role);
  /** Réception : RDV est déjà dans les CTAs rôle — éviter le doublon Agenda. */
  const showGenericAgenda =
    showAgenda && !roleCtas.some((c) => c.target === "agenda");
  const { refreshControl } = usePullRefresh({
    keys: [qk.dashboard, qk.me],
    refetch: [
      () => refetch(),
      async () => {
        const me = await api.me();
        if (me) setUser(me);
      },
    ],
  });

  return (
    <BrandBackground dark={!!dark}>
      <ScreenEnter>
        <Header
          title="DotoHub"
          subtitle={`${user.full_name} · ${user.role_label}`}
          right={
            <PressScale onPress={() => onNavigate("parametres")}>
              <Avatar uri={user.photo_url} name={user.full_name} size={40} ring={false} />
            </PressScale>
          }
        />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          refreshControl={refreshControl}
        >
          {errMsg ? (
            <Text style={{ color: colors.amber, fontWeight: "700" }}>{errMsg}</Text>
          ) : null}

          {showSkeleton ? (
            <HomeSkeleton dark={!!dark} />
          ) : (
            <>
              <StaggerItem index={0}>
                <Card colors={colors} decor="navy">
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
                    STRUCTURE
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17, marginTop: 4 }}>
                    {dash?.structure_principale?.nom || "—"}
                  </Text>
                </Card>
              </StaggerItem>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <PressScale onPress={() => onNavigate("scan")} style={{ flex: 1, borderRadius: 18, overflow: "hidden" }}>
                  <LinearGradient colors={[C.navy, C.blue]} style={{ padding: 16, borderRadius: 18, minHeight: 96 }}>
                    <IconBadge name="qr-code-outline" color={onBrand} bg="rgba(255,255,255,0.18)" />
                    <Text style={{ color: onBrand, fontWeight: "800", marginTop: 10 }}>Scanner</Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>DodoCard QR</Text>
                  </LinearGradient>
                </PressScale>
                <PressScale onPress={() => onNavigate("recherche")} style={{ flex: 1, borderRadius: 18, overflow: "hidden" }}>
                  <LinearGradient colors={[C.blue, "#2f6a7a"]} style={{ padding: 16, borderRadius: 18, minHeight: 96 }}>
                    <IconBadge name="search-outline" color={onBrand} bg="rgba(255,255,255,0.18)" />
                    <Text style={{ color: onBrand, fontWeight: "800", marginTop: 10 }}>Rechercher</Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>NPI ou nom</Text>
                  </LinearGradient>
                </PressScale>
              </View>

              {roleCtas.map((cta) => (
                <RoleCtaTile
                  key={cta.id}
                  cta={cta}
                  onPress={() => onNavigate(cta.target as HomeNavTarget)}
                />
              ))}

              {showGenericAgenda ? (
                <PressScale onPress={() => onNavigate("agenda")} style={{ borderRadius: 18, overflow: "hidden" }}>
                  <LinearGradient
                    colors={["#1E3755", "#3E8295"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <IconBadge name="calendar-outline" color={onBrand} bg="rgba(255,255,255,0.18)" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: onBrand, fontWeight: "800", fontSize: 16 }}>Agenda</Text>
                      <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
                        Rendez-vous de la structure
                      </Text>
                    </View>
                  </LinearGradient>
                </PressScale>
              ) : null}

              <StaggerItem index={1}>
                <Card colors={colors}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 10 }}>
                    ACTIVITÉ
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20 }}>
                        {stats.consultations_7j ?? 0}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Consult. 7j</Text>
                    </View>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20 }}>
                        {stats.ordonnances_actives ?? 0}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Ordonnances</Text>
                    </View>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20 }}>
                        {stats.scans_7j ?? 0}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Scans</Text>
                    </View>
                  </View>
                </Card>
              </StaggerItem>

              <StaggerItem index={2}>
                <Card colors={colors} decor="teal">
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 8 }}>
                    PATIENTS RÉCENTS
                  </Text>
                  {(dash?.patients_recents || []).length === 0 ? (
                    <EmptyState
                      icon="people-outline"
                      title="Aucun patient récent"
                      subtitle="Scannez ou recherchez un dossier"
                      dark={!!dark}
                    />
                  ) : (
                    (dash?.patients_recents || []).map((p: any) => (
                      <PressScale
                        key={p.id}
                        onPress={() => onOpenPatient(p.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 4,
                          minHeight: 52,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Avatar
                          uri={p.photo_url}
                          name={p.full_name || `${p.prenom || ""} ${p.nom || ""}`.trim()}
                          size={36}
                          bg={C.teal}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "700" }}>
                            {p.full_name || `${p.prenom || ""} ${p.nom || ""}`.trim()}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: "monospace" }}>
                            {p.npi}
                          </Text>
                        </View>
                      </PressScale>
                    ))
                  )}
                </Card>
              </StaggerItem>
            </>
          )}
        </ScrollView>
      </ScreenEnter>
    </BrandBackground>
  );
}
