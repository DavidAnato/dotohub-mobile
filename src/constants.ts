/** Constantes partagées DotoHub mobile - alignées sur `core/contracts.py`. */

export const HOSPITAL_REQUIRED_ROLES = [
  "medecin",
  "infirmier",
  "pharmacien",
  "laborantin",
  "ambulancier",
  "receptionniste",
] as const;

export function needsHospitalAttach(user?: {
  role?: string;
  structures?: { id?: number }[] | null;
  structure_principale?: number | null;
  type_exercice?: string | null;
  nom_etablissement?: string | null;
} | null): boolean {
  if (!user || !(HOSPITAL_REQUIRED_ROLES as readonly string[]).includes(user.role || "")) {
    return false;
  }
  if (user.type_exercice === "independant" && (user.nom_etablissement || "").trim()) return false;
  const ids = user.structures || [];
  return !ids.length || !user.structure_principale;
}

export const PIN_LEN = 4;
export const OTP_LEN = 5;
export const PIN_REGEX = /^\d{4}$/;
export const OTP_REGEX = /^\d{5}$/;

export const SPECIALITES = [
  "Médecine générale",
  "ORL",
  "Gynécologie-obstétrique",
  "Cardiologie",
  "Pédiatrie",
  "Dermatologie",
  "Ophtalmologie",
  "Chirurgie générale",
  "Traumatologie-orthopédie",
  "Neurologie",
  "Psychiatrie",
  "Urologie",
  "Gastro-entérologie",
  "Pneumologie",
  "Rhumatologie",
  "Endocrinologie",
  "Néphrologie",
  "Oncologie",
  "Anesthésie-réanimation",
  "Médecine interne",
  "Médecine d'urgence",
  "Radiologie",
  "Biologie médicale",
  "Santé publique",
  "Stomatologie",
  "Néonatologie",
];

export const PRISE_EN_CHARGE = [
  { value: "consultation", label: "Consultation" },
  { value: "hospitalisation", label: "Hospitalisation" },
  { value: "urgence", label: "Urgence" },
  { value: "suivi", label: "Suivi/Contrôle" },
] as const;

export const MEDICAMENT_FORMES = [
  "comprimé",
  "gélule",
  "sirop",
  "sachet",
  "ampoule",
  "flacon",
  "gouttes",
  "pommade",
  "crème",
  "suppositoire",
  "inhalateur",
  "patch",
  "injectable",
  "autre",
];

export const MEDICAMENT_MOMENTS = [
  { value: "", label: "-" },
  { value: "a_jeun", label: "À jeun" },
  { value: "avant_repas", label: "Avant les repas" },
  { value: "pendant_repas", label: "Pendant les repas" },
  { value: "apres_repas", label: "Après les repas" },
  { value: "entre_repas", label: "Entre les repas" },
  { value: "au_coucher", label: "Au coucher" },
];

export const BON_STATUTS: Record<string, { label: string; color: string }> = {
  demande: { label: "Demandé", color: "#2563EB" },
  recu: { label: "Reçu", color: "#0F766E" },
  en_cours: { label: "En cours", color: "#B45309" },
  resultat_disponible: { label: "Résultat disponible", color: "#15803D" },
  cloture: { label: "Clôturé", color: "#64748B" },
};

export function nowISO(): string {
  return new Date().toISOString();
}

export function nowDateISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export type MedLine = {
  nom: string;
  dosage: string;
  forme: string;
  quantite: string;
  unites_par_prise: string;
  frequence_par_jour: string;
  duree_jours: number | "";
  moment: string;
  instructions: string;
};

export function emptyMedLine(): MedLine {
  return {
    nom: "",
    dosage: "",
    forme: "comprimé",
    quantite: "1 boîte",
    unites_par_prise: "",
    frequence_par_jour: "",
    duree_jours: 3,
    moment: "",
    instructions: "",
  };
}

export function summarizeMed(m: {
  nom?: string;
  dosage?: string;
  forme?: string;
  quantite?: string;
  unites_par_prise?: string;
  frequence_par_jour?: string;
  frequence?: string;
  duree_jours?: number | "";
  moment?: string;
  instructions?: string;
}): string {
  const poso =
    m.unites_par_prise && m.frequence_par_jour
      ? `${m.unites_par_prise} × ${m.frequence_par_jour}`
      : m.frequence || "";
  const duree = m.duree_jours
    ? `pendant ${m.duree_jours} jour${Number(m.duree_jours) > 1 ? "s" : ""}`
    : "";
  const moment = MEDICAMENT_MOMENTS.find((x) => x.value === m.moment)?.label;
  return [
    m.nom,
    m.dosage,
    m.forme,
    m.quantite,
    poso,
    duree,
    moment && moment !== "-" ? moment : "",
    m.instructions,
  ]
    .filter(Boolean)
    .join(" - ");
}
