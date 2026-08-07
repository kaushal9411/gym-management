'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingChecklistService } from '../services/onboarding-checklist.service';

export function useOnboardingChecklist() {
  return useQuery({
    queryKey: ['onboarding-checklist'],
    queryFn: () => onboardingChecklistService.getStatus(),
    staleTime: 60_000,
  });
}

export function useDismissOnboardingChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => onboardingChecklistService.dismiss(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['onboarding-checklist'] }),
  });
}
