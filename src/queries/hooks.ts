import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { qk } from "./keys";

export function useHubDashboard(enabled = true) {
  return useQuery({
    queryKey: qk.dashboard,
    enabled,
    queryFn: () => api.hubDashboard(),
  });
}

export function usePatientQuery(id: number | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.patient(id ?? "none"),
    enabled: id != null,
    queryFn: () => api.patient(id!),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always",
    networkMode: "online",
  });

  useEffect(() => {
    if (id == null) return;
    // Prefetch sections seulement si consentement déjà accordé (évite 403 spam).
    const consent = (query.data as any)?.consent;
    if (consent?.required && !consent?.granted) return;
    void qc.prefetchQuery({
      queryKey: qk.consultations(id),
      queryFn: () => api.consultations(id),
    });
    void qc.prefetchQuery({
      queryKey: qk.ordonnances(id),
      queryFn: () => api.ordonnances(id),
    });
    void qc.prefetchQuery({
      queryKey: qk.examens(id),
      queryFn: () => api.examens(id),
    });
    void qc.prefetchQuery({
      queryKey: qk.constantes(id),
      queryFn: () => api.constantes(id),
    });
  }, [id, qc, query.data]);

  return query;
}

export function useSearchMutation() {
  return useMutation({
    mutationFn: (params: { npi?: string; nom?: string }) => api.searchPatients(params),
  });
}

export function useScanMutation() {
  return useMutation({
    mutationFn: (token: string) => api.scanDodoCard(token),
  });
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: () => {
      qc.clear();
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useConsultations(patientId: number | undefined) {
  return useQuery({
    queryKey: qk.consultations(patientId ?? 0),
    enabled: !!patientId,
    queryFn: () => api.consultations(patientId!),
  });
}

export function useOrdonnances(patientId: number | undefined) {
  return useQuery({
    queryKey: qk.ordonnances(patientId ?? 0),
    enabled: !!patientId,
    queryFn: () => api.ordonnances(patientId!),
  });
}

export function useExamens(patientId: number | undefined) {
  return useQuery({
    queryKey: qk.examens(patientId ?? 0),
    enabled: !!patientId,
    queryFn: () => api.examens(patientId!),
  });
}

export function useConstantes(patientId: number | undefined) {
  return useQuery({
    queryKey: qk.constantes(patientId ?? 0),
    enabled: !!patientId,
    queryFn: () => api.constantes(patientId!),
  });
}
