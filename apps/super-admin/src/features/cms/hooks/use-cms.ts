'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminCmsService } from '../services/cms.service';
import type { UpsertCmsPageInput } from '../types';

export function toCmsError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useCmsPages() {
  return useQuery({ queryKey: ['admin', 'cms'], queryFn: () => adminCmsService.list() });
}

export function useCreateCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCmsPageInput) => adminCmsService.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}

export function useUpdateCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: Partial<UpsertCmsPageInput> }) => adminCmsService.update(slug, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}

export function useDeleteCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => adminCmsService.remove(slug),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}
