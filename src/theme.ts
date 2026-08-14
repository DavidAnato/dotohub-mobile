/** DotoHub Mobile — thème pro (bleu nuit / bleu clair). */
export const C = {
  navy: "#1E3755",
  blue: "#3E8295",
  teal: "#3E8295",
  emerald: "#3E8295",
  lightTeal: "#E8F2F5",
  lightBlue: "#E8F2F5",
  amber: "#92400E",
  amberSoft: "#FEF3C7",
  emergency: "#A32D2D",
  emergencySoft: "#F8EAEA",
  bg: "#F1F5F9",
  white: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  grey: "#94A3B8",
};

/** Variante sombre — fond noir mat, surfaces élevées, teal en accent uniquement */
export const darkC = {
  ...C,
  bg: "#0A0A0A",
  white: "#161616",
  border: "#2A2A2A",
  text: "#F5F5F5",
  muted: "#A3A3A3",
  grey: "#737373",
  lightBlue: "#1C1C1C",
  lightTeal: "#1C1C1C",
  amber: "#FCD34D",
  amberSoft: "#422006",
  emergency: "#F87171",
  emergencySoft: "#450A0A",
  /** Titres / accents texte (pas fond page) */
  navy: "#F5F5F5",
};

/** Navy marque (headers / boutons) — ne change jamais en dark mode */
export const brandNavy = "#1E3755";
export const brandBlue = "#3E8295";
export const onBrand = "#FFFFFF";

export type ProUser = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email?: string;
  telephone?: string;
  role: string;
  role_label: string;
  photo_url?: string | null;
  photo_required?: boolean;
  pin_set?: boolean;
  specialite?: string;
  structures?: { id?: number; nom: string }[];
  structure_principale?: number | null;
};

/** Onglets dossier filtrés par rôle (aligné API / Dotohub web). */
export const ROLE_TABS: Record<string, string[]> = {
  medecin: ["historique", "ordonnances", "examens", "constantes", "assurance"],
  infirmier: ["historique", "constantes", "examens"],
  pharmacien: ["ordonnances"],
  laborantin: ["examens"],
  ambulancier: ["constantes"],
  receptionniste: ["assurance"],
  admin: ["historique", "ordonnances", "examens", "constantes", "assurance"],
};

export const TAB_LABELS: Record<string, string> = {
  historique: "Historique",
  ordonnances: "Ordonnances",
  examens: "Examens",
  constantes: "Constantes",
  assurance: "Assurance",
};

/** Onglet Agenda (bottom tabs) — masqué pour pharma / labo / ambulancier. */
export const AGENDA_TAB_ROLES = new Set([
  "medecin",
  "admin",
  "infirmier",
  "receptionniste",
]);

export function roleHasAgendaTab(role?: string | null): boolean {
  if (!role) return false;
  return AGENDA_TAB_ROLES.has(role);
}

/** Destinations stack Home (hors onglets). */
export type RoleNavStackScreen =
  | "PharmaFile"
  | "LaboFile"
  | "Tournee"
  | "NouveauPatient"
  | "UrgencePro";

export type RoleNavCta = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  /** Onglet bottom ou écran stack. */
  target: "agenda" | "scan" | RoleNavStackScreen;
  /** Mise en avant (ex. urgence ambulancier). */
  emphasis?: boolean;
};

/** Tuiles / CTAs Home selon le rôle (en plus de Scanner / Recherche). */
export function roleHomeCtas(role: string): RoleNavCta[] {
  switch (role) {
    case "receptionniste":
      return [
        {
          id: "nouveau-patient",
          title: "Nouveau patient",
          subtitle: "Créer un dossier",
          icon: "person-add-outline",
          target: "NouveauPatient",
        },
        {
          id: "rdv",
          title: "RDV",
          subtitle: "Rendez-vous de la structure",
          icon: "calendar-outline",
          target: "agenda",
        },
      ];
    case "pharmacien":
      return [
        {
          id: "dispenser",
          title: "À dispenser",
          subtitle: "Ordonnances en file",
          icon: "medkit-outline",
          target: "PharmaFile",
        },
      ];
    case "laborantin":
      return [
        {
          id: "file-labo",
          title: "File labo",
          subtitle: "Examens à traiter",
          icon: "flask-outline",
          target: "LaboFile",
        },
      ];
    case "infirmier":
      return [
        {
          id: "tournee",
          title: "Tournée du jour",
          subtitle: "Patients & constantes",
          icon: "walk-outline",
          target: "Tournee",
        },
      ];
    case "ambulancier":
      return [
        {
          id: "scan-urgence",
          title: "Scan urgence",
          subtitle: "Scanner DotoCard",
          icon: "qr-code-outline",
          target: "scan",
          emphasis: true,
        },
      ];
    default:
      return [];
  }
}
