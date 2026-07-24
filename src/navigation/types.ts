export type MainTabParamList = {
  Home: undefined;
  Recherche: undefined;
  Scan: undefined;
  Agenda: undefined;
  Parametres: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Patient: { patientId: number };
  ConsentWaiting: {
    patientId: number;
    npi: string;
    name: string;
    accessRequestId?: number;
  };
  PharmaFile: undefined;
  LaboFile: undefined;
  Tournee: undefined;
  NouveauPatient: undefined;
  UrgencePro: { patientId?: number };
};
