export const qk = {
  me: ["hub", "me"] as const,
  dashboard: ["hub", "dashboard"] as const,
  patient: (id: number | string) => ["hub", "patient", id] as const,
  search: (params: string) => ["hub", "search", params] as const,
  consultations: (id: number) => ["hub", "consultations", id] as const,
  ordonnances: (id: number) => ["hub", "ordonnances", id] as const,
  examens: (id: number) => ["hub", "examens", id] as const,
  constantes: (id: number) => ["hub", "constantes", id] as const,
};
