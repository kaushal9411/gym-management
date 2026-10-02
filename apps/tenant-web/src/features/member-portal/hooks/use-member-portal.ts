import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { memberPortalService } from '../services/member-portal.service';

export function useMemberProfile() {
  return useQuery({ queryKey: ['member-portal', 'me'], queryFn: memberPortalService.getProfile });
}

export function useChangeMemberPassword() {
  return useMutation({ mutationFn: memberPortalService.changePassword });
}

export function useStartRenewalCheckout() {
  return useMutation({ mutationFn: memberPortalService.startRenewalCheckout });
}

export function useVerifyRenewalCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string } }) =>
      memberPortalService.verifyRenewalCheckout(paymentId, payload),
    onSuccess: (result) => {
      if (result.status === 'SUCCESS') void queryClient.invalidateQueries({ queryKey: ['member-portal'] });
    },
  });
}

export function useMemberAttendance(page = 1, limit = 20) {
  return useQuery({ queryKey: ['member-portal', 'attendance', page, limit], queryFn: () => memberPortalService.getAttendance(page, limit) });
}

export function useMemberWorkout() {
  return useQuery({ queryKey: ['member-portal', 'workout'], queryFn: memberPortalService.getWorkout });
}

export function useMemberMeasurements() {
  return useQuery({ queryKey: ['member-portal', 'measurements'], queryFn: memberPortalService.getMeasurements });
}

export function useMarkWorkoutProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, exerciseId, status, notes }: { assignmentId: string; exerciseId: string; status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; notes?: string }) =>
      memberPortalService.markWorkoutProgress(assignmentId, exerciseId, status, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-portal', 'workout'] }),
  });
}

export function useMemberDiet() {
  return useQuery({ queryKey: ['member-portal', 'diet'], queryFn: memberPortalService.getDiet });
}

export function useLogDiet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, input }: { assignmentId: string; input: { date: string; waterIntakeMl?: number; weightKg?: number; mealsStatus?: Record<string, string>; notes?: string } }) =>
      memberPortalService.logDiet(assignmentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-portal', 'diet'] }),
  });
}

export function useMemberInvoices(page = 1, limit = 20) {
  return useQuery({ queryKey: ['member-portal', 'invoices', page, limit], queryFn: () => memberPortalService.getInvoices(page, limit) });
}

export function useStartInvoicePaymentCheckout() {
  return useMutation({ mutationFn: (invoiceId: string) => memberPortalService.startInvoicePaymentCheckout(invoiceId) });
}

export function useVerifyInvoicePaymentCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, paymentId, payload }: { invoiceId: string; paymentId: string; payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string } }) =>
      memberPortalService.verifyInvoicePaymentCheckout(invoiceId, paymentId, payload),
    // Paying an invoice can also activate a PENDING membership (see
    // `activatePendingMembershipIfAny` on the backend) — invalidate
    // everything member-portal, not just 'invoices', so the dashboard's
    // membership tile reflects it immediately too.
    onSuccess: (result) => {
      if (result.status === 'SUCCESS') void queryClient.invalidateQueries({ queryKey: ['member-portal'] });
    },
  });
}

export function useMemberNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['member-portal', 'notifications', params], queryFn: () => memberPortalService.getNotifications(params) });
}

export function useMarkMemberNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => memberPortalService.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-portal', 'notifications'] }),
  });
}

export function useMarkAllMemberNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => memberPortalService.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-portal', 'notifications'] }),
  });
}

export function useMemberClasses(dateFrom: string, dateTo: string) {
  return useQuery({ queryKey: ['member-portal', 'classes', dateFrom, dateTo], queryFn: () => memberPortalService.getUpcomingClasses(dateFrom, dateTo) });
}

export function useMemberBookings() {
  return useQuery({ queryKey: ['member-portal', 'bookings'], queryFn: memberPortalService.getMyBookings });
}

function useInvalidateMemberClasses() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['member-portal', 'classes'] });
    void queryClient.invalidateQueries({ queryKey: ['member-portal', 'bookings'] });
  };
}

export function useBookClass() {
  const invalidate = useInvalidateMemberClasses();
  return useMutation({ mutationFn: (sessionId: string) => memberPortalService.bookClass(sessionId), onSuccess: invalidate });
}

export function useCancelMemberBooking() {
  const invalidate = useInvalidateMemberClasses();
  return useMutation({ mutationFn: (bookingId: string) => memberPortalService.cancelBooking(bookingId), onSuccess: invalidate });
}
