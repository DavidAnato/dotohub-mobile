export type MainTabParamList = {
  Home: undefined;
  Recherche: undefined;
  Scan: undefined;
  Agenda: undefined;
  Parametres: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Patient: { patientId: number; consultId?: number };
  ConsentWaiting: {
    patientId: number;
    npi: string;
    name: string;
    accessRequestId?: number;
    message?: string;
  };
  PharmaFile: undefined;
  LaboFile: undefined;
  Tournee: undefined;
  NouveauPatient: undefined;
  Demandes: undefined;
  UrgencePro: { patientId?: number };
};
