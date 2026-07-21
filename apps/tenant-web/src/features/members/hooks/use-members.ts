'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { memberService } from '../services/member.service';
import type {
  AssignMembershipPayload,
  CancelMembershipPayload,
  CreateMemberPayload,
  CreateMembershipPlanPayload,
  DowngradeMembershipPayload,
  ExtendMembershipPayload,
  ListMembersParams,
  ListMembershipPlansParams,
  MemberBulkImportRow,
  MemberDocumentType,
  RenewMembershipPayload,
  UpdateMemberPayload,
  UpdateMembershipPlanPayload,
  UpgradeMembershipPayload,
} from '../types';

export function toMemberError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['members'] });
}

export function useMemberList(params: ListMembersParams) {
  return useQuery({ queryKey: ['members', 'list', params], queryFn: () => memberService.list(params) });
}

export function useMemberDetail(id: string | null) {
  return useQuery({
    queryKey: ['members', 'detail', id],
    queryFn: () => memberService.getById(id!),
    enabled: id !== null,
  });
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (payload: CreateMemberPayload) => memberService.create(payload), onSuccess: invalidate });
}

export function useUpdateMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMemberPayload }) => memberService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useMemberStatusAction() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'unfreeze' | 'restore' | 'delete' }) => {
      if (action === 'activate') return memberService.activate(id);
      if (action === 'deactivate') return memberService.deactivate(id);
      if (action === 'unfreeze') return memberService.unfreeze(id);
      if (action === 'restore') return memberService.restore(id);
      return memberService.softDelete(id);
    },
    onSuccess: invalidate,
  });
}

export function useFreezeMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => memberService.freeze(id, reason),
    onSuccess: invalidate,
  });
}

export function useAssignMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignMembershipPayload }) => memberService.assignMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useRenewMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RenewMembershipPayload }) => memberService.renewMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useUpgradeMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpgradeMembershipPayload }) => memberService.upgradeMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useDowngradeMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DowngradeMembershipPayload }) => memberService.downgradeMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useExtendMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExtendMembershipPayload }) => memberService.extendMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useCancelMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CancelMembershipPayload }) => memberService.cancelMembership(id, payload),
    onSuccess: invalidate,
  });
}

export function useResumeMembership() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (id: string) => memberService.resumeMembership(id), onSuccess: invalidate });
}

export function useTransferBranch() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) => memberService.transferBranch(id, branchId),
    onSuccess: invalidate,
  });
}

export function useAssignTrainer() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ id, trainerId }: { id: string; trainerId: string | null }) => memberService.assignTrainer(id, trainerId),
    onSuccess: invalidate,
  });
}

export function useRegenerateQrCode() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (id: string) => memberService.regenerateQrCode(id), onSuccess: invalidate });
}

export function useMemberDocuments(id: string | null) {
  return useQuery({
    queryKey: ['members', 'documents', id],
    queryFn: () => memberService.listDocuments(id!),
    enabled: id !== null,
  });
}

export function useUploadMemberDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, fileName, fileDataUrl }: { id: string; type: MemberDocumentType; fileName: string; fileDataUrl: string }) =>
      memberService.uploadDocument(id, type, fileName, fileDataUrl),
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ['members', 'documents', variables.id] }),
  });
}

export function useDeleteMemberDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) => memberService.deleteDocument(id, documentId),
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ['members', 'documents', variables.id] }),
  });
}

export function useBulkImportMembers() {
  const invalidate = useInvalidateMembers();
  return useMutation({ mutationFn: (rows: MemberBulkImportRow[]) => memberService.bulkImport(rows), onSuccess: invalidate });
}

export function useBulkMemberAction() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ memberIds, action }: { memberIds: string[]; action: 'activate' | 'deactivate' | 'delete' }) => {
      if (action === 'activate') return memberService.bulkActivate(memberIds);
      if (action === 'deactivate') return memberService.bulkDeactivate(memberIds);
      return memberService.bulkDelete(memberIds);
    },
    onSuccess: invalidate,
  });
}

// ── Membership Plans (Prompt 15) ──────────────────────────────────────────

function useInvalidateMembershipPlans() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['members', 'plans'] });
}

/** Active-only, unfiltered — backs Assign/Renew/Upgrade/Downgrade plan dropdowns. */
export function useAssignablePlans() {
  return useQuery({ queryKey: ['members', 'plans', 'assignable'], queryFn: () => memberService.listAssignablePlans() });
}

export function useMembershipPlanList(params: ListMembershipPlansParams) {
  return useQuery({ queryKey: ['members', 'plans', 'list', params], queryFn: () => memberService.listPlans(params) });
}

export function useMembershipPlanDetail(planId: string | null) {
  return useQuery({
    queryKey: ['members', 'plans', 'detail', planId],
    queryFn: () => memberService.getPlanById(planId!),
    enabled: planId !== null,
  });
}

export function useCreateMembershipPlan() {
  const invalidate = useInvalidateMembershipPlans();
  return useMutation({ mutationFn: (payload: CreateMembershipPlanPayload) => memberService.createPlan(payload), onSuccess: invalidate });
}

export function useUpdateMembershipPlan() {
  const invalidate = useInvalidateMembershipPlans();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: UpdateMembershipPlanPayload }) => memberService.updatePlan(planId, payload),
    onSuccess: invalidate,
  });
}

export function useMembershipPlanStatusAction() {
  const invalidate = useInvalidateMembershipPlans();
  return useMutation({
    mutationFn: async ({ planId, action }: { planId: string; action: 'activate' | 'deactivate' | 'restore' | 'delete' }) => {
      if (action === 'activate') return memberService.activatePlan(planId);
      if (action === 'deactivate') return memberService.deactivatePlan(planId);
      if (action === 'restore') {
        await memberService.restorePlan(planId);
        return;
      }
      return memberService.deletePlan(planId);
    },
    onSuccess: invalidate,
  });
}

export function useDuplicateMembershipPlan() {
  const invalidate = useInvalidateMembershipPlans();
  return useMutation({ mutationFn: (planId: string) => memberService.duplicatePlan(planId), onSuccess: invalidate });
}
