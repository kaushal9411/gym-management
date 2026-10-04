import type { BodyMeasurement } from '@/features/measurements/types';
import { memberApiClient, toMemberAuthServiceError } from './member-api-client';

interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface MemberPortalProfile {
  id: string;
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  qrCodeImageUrl: string | null;
  status: string;
  branch: { id: string; name: string };
  trainer: { id: string; name: string } | null;
  currentMembership: { planName: string; endDate: string; status: string } | null;
  joiningDate: string;
}

export interface MemberPortalAttendanceItem {
  id: string;
  branch: { id: string; name: string };
  checkInTime: string;
  checkOutTime: string | null;
  attendanceDate: string;
  method: string;
  status: string;
}

export interface MemberPortalWorkout {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trainerRemarks: string | null;
  workoutPlan: { id: string; name: string; level: string; durationWeeks: number; exercises: { exerciseId: string; name: string; dayOfWeek: string }[] };
  progress: { exerciseId: string; status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; notes: string | null; markedAt: string | null }[];
}

export interface MemberPortalDiet {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trainerRemarks: string | null;
  dietPlan: { id: string; name: string; dailyCalories: number | null; durationDays: number; mealTypes: string[] };
  dailyLogs: { date: string; waterIntakeMl: number | null; weightKg: string | null; mealsStatus: Record<string, string> | null; notes: string | null }[];
}

export interface MemberPortalInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  status: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MemberPortalPayment {
  id: string;
  paymentNumber: string;
  amount: string;
  method: string;
  status: string;
  paymentDate: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  totalRefunded: string;
}

export interface MemberInvoiceDetail {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  items: { description: string; quantity: number; unitPrice: string; amount: string }[];
  payments: { paymentNumber: string; finalAmount: string; status: string; paymentDate: string }[];
  paid: string;
  balance: string;
  branch: { name: string } | null;
}

export interface MemberPortalClassSession {
  id: string;
  groupClass: { id: string; name: string };
  branch: { id: string; name: string };
  trainer: { id: string; name: string } | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}

export type MemberNotificationCategory =
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'SUBSCRIPTION'
  | 'GENERAL'
  | 'MEMBER'
  | 'MEMBERSHIP'
  | 'PAYMENT'
  | 'ATTENDANCE'
  | 'WORKOUT'
  | 'DIET'
  | 'STAFF';

export interface MemberPortalNotification {
  id: string;
  category: MemberNotificationCategory;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MemberNotificationListResult extends Paginated<MemberPortalNotification> {
  unreadCount: number;
}

/** Same shape `/subscription/checkout` and `/onboarding/checkout` already return — reuses the existing `loadRazorpayScript`+Checkout-modal pattern verbatim, see `features/billing/components/checkout-dialog.tsx`. */
export type RenewalCheckoutResult =
  | { requiresPayment: false }
  | { requiresPayment: true; paymentId: string; orderId: string; amount: number; currency: string; keyId: string };

/** `'SUCCESS'`/`'FAILED'` — matches the backend's `MemberPaymentStatus` enum, not the platform-billing `'SUCCEEDED'` wording used elsewhere in this app. */
export interface VerifyRenewalCheckoutResult {
  status: 'SUCCESS' | 'FAILED';
}

export interface MemberPortalBooking {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
  bookedAt: string;
  session: {
    id: string;
    groupClass: { id: string; name: string };
    branch: { id: string; name: string };
    sessionDate: string;
    startTime: string;
    endTime: string;
  };
}

export const memberPortalService = {
  async getProfile(): Promise<MemberPortalProfile> {
    try {
      const res = await memberApiClient.get<Envelope<MemberPortalProfile>>('/portal/me');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getAttendance(page = 1, limit = 20): Promise<Paginated<MemberPortalAttendanceItem>> {
    try {
      const res = await memberApiClient.get<Envelope<Paginated<MemberPortalAttendanceItem>>>('/portal/attendance', { params: { page, limit } });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getWorkout(): Promise<MemberPortalWorkout | null> {
    try {
      const res = await memberApiClient.get<Envelope<MemberPortalWorkout | null>>('/portal/workout');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async markWorkoutProgress(assignmentId: string, exerciseId: string, status: 'PENDING' | 'COMPLETED' | 'SKIPPED', notes?: string): Promise<MemberPortalWorkout> {
    try {
      const res = await memberApiClient.post<Envelope<MemberPortalWorkout>>(`/portal/workout/${assignmentId}/progress`, { exerciseId, status, notes });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getDiet(): Promise<MemberPortalDiet | null> {
    try {
      const res = await memberApiClient.get<Envelope<MemberPortalDiet | null>>('/portal/diet');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async logDiet(assignmentId: string, input: { date: string; waterIntakeMl?: number; weightKg?: number; mealsStatus?: Record<string, string>; notes?: string }): Promise<MemberPortalDiet> {
    try {
      const res = await memberApiClient.post<Envelope<MemberPortalDiet>>(`/portal/diet/${assignmentId}/log`, input);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  /** Own body measurement history, newest first — reuses the staff-side `BodyMeasurement` DTO shape (identical, nothing needs hiding for the member it belongs to). */
  async getMeasurements(): Promise<BodyMeasurement[]> {
    try {
      const res = await memberApiClient.get<Envelope<BodyMeasurement[]>>('/portal/measurements');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getInvoices(page = 1, limit = 20): Promise<Paginated<MemberPortalInvoice>> {
    try {
      const res = await memberApiClient.get<Envelope<Paginated<MemberPortalInvoice>>>('/portal/invoices', { params: { page, limit } });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getUpcomingClasses(dateFrom: string, dateTo: string): Promise<MemberPortalClassSession[]> {
    try {
      const res = await memberApiClient.get<Envelope<MemberPortalClassSession[]>>('/portal/classes', { params: { dateFrom, dateTo } });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getMyBookings(): Promise<MemberPortalBooking[]> {
    try {
      const res = await memberApiClient.get<Envelope<MemberPortalBooking[]>>('/portal/bookings');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async bookClass(sessionId: string): Promise<void> {
    try {
      await memberApiClient.post(`/portal/classes/${sessionId}/book`);
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async cancelBooking(bookingId: string): Promise<void> {
    try {
      await memberApiClient.post(`/portal/bookings/${bookingId}/cancel`);
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getNotifications(params: { unreadOnly?: boolean; category?: MemberNotificationCategory; page?: number; limit?: number } = {}): Promise<MemberNotificationListResult> {
    try {
      const res = await memberApiClient.get<Envelope<MemberNotificationListResult>>('/portal/notifications', { params });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
    try {
      const res = await memberApiClient.get<Envelope<{ unreadCount: number }>>('/portal/notifications/unread-count');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await memberApiClient.post(`/portal/notifications/${notificationId}/read`);
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    try {
      await memberApiClient.post('/portal/notifications/read-all');
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async startRenewalCheckout(): Promise<RenewalCheckoutResult> {
    try {
      const res = await memberApiClient.post<Envelope<RenewalCheckoutResult>>('/portal/membership/renew/checkout');
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async verifyRenewalCheckout(
    paymentId: string,
    payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ): Promise<VerifyRenewalCheckoutResult> {
    try {
      const res = await memberApiClient.post<Envelope<VerifyRenewalCheckoutResult>>(`/portal/membership/renew/checkout/${paymentId}/verify`, payload);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  /** Same Razorpay Orders + Checkout-modal shape as `startRenewalCheckout`, just for an existing outstanding invoice instead of a plan renewal. */
  async startInvoicePaymentCheckout(invoiceId: string): Promise<RenewalCheckoutResult> {
    try {
      const res = await memberApiClient.post<Envelope<RenewalCheckoutResult>>(`/portal/invoices/${invoiceId}/pay/checkout`);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async verifyInvoicePaymentCheckout(
    invoiceId: string,
    paymentId: string,
    payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ): Promise<VerifyRenewalCheckoutResult> {
    try {
      const res = await memberApiClient.post<Envelope<VerifyRenewalCheckoutResult>>(`/portal/invoices/${invoiceId}/pay/checkout/${paymentId}/verify`, payload);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  /** In-app password change — distinct from the logged-out forgot-password/reset-token flow. Revokes every other active session on success; this device stays signed in. */
  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    try {
      await memberApiClient.post('/portal/change-password', input);
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getPayments(page = 1, limit = 20): Promise<Paginated<MemberPortalPayment>> {
    try {
      const res = await memberApiClient.get<Envelope<Paginated<MemberPortalPayment>>>('/portal/payments', { params: { page, limit } });
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async getInvoice(invoiceId: string): Promise<MemberInvoiceDetail> {
    try {
      const res = await memberApiClient.get<Envelope<MemberInvoiceDetail>>(`/portal/invoices/${invoiceId}`);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async downloadInvoice(invoiceId: string, invoiceNumber: string): Promise<void> {
    const res = await memberApiClient.get(`/portal/invoices/${invoiceId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /** GDPR data-portability export — downloads everything on file as a JSON file. */
  async downloadGdprExport(memberCode: string): Promise<void> {
    let data: unknown;
    try {
      const res = await memberApiClient.get<Envelope<unknown>>('/portal/gdpr-export');
      data = res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${memberCode}-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

/** `GET /portal/overview` — one aggregated payload for the dashboard. Every block except `member`/`attendance`/`billing`/`classes`/`notifications` may be null (hide the element, never fake it). */
export interface MemberOverview {
  member: { id: string; memberId: string; name: string; photoUrl: string | null; joiningDate: string; branch: { id: string; name: string } | null; trainer: { id: string; name: string } | null };
  membership: { planName: string; status: string; startDate: string | null; endDate: string; daysLeft: number; totalDays: number | null; price: string | number | null; amountPaid: string | number | null; expired: boolean } | null;
  attendance: {
    thisMonth: { visits: number; previous: number };
    currentStreakDays: number;
    bestStreakDays: number;
    totalVisits: number;
    avgVisitMinutes: number | null;
    lastVisitAt: string | null;
    weekday: { weekday: number; count: number }[];
    daily: { date: string; visits: number }[];
  };
  workout: { planName: string; progressPercent: number; completedExercises: number; totalExercises: number; completedThisWeek: number } | null;
  diet: { planName: string; dailyCalories: number | null; loggedToday: boolean; waterTodayMl: number | null; latestWeightKg: string | number | null } | null;
  billing: { outstanding: { value: string | number; invoiceCount: number }; nextDueDate: string | null; paidLast90Days: { value: string | number; count: number } };
  classes: { upcoming: { sessionId: string; name: string; date: string; startTime: string; endTime: string; trainerName: string | null; bookingStatus: string }[] };
  notifications: { unread: number };
}

/** `GET /portal/gym` - gym + the member's branch contact info (every field may be null: hide the element). */
export interface MemberGymAddress {
  line1: string | null;
  line2?: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
}
export interface MemberGymHour {
  day: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}
export interface MemberGymInfo {
  name: string;
  logoUrl: string | null;
  address: MemberGymAddress | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  businessHours: MemberGymHour[] | null;
  social: Record<string, string> | null;
  branch: { name: string; phone: string | null; email: string | null; address: MemberGymAddress | null; businessHours: MemberGymHour[] | null } | null;
}

export async function fetchMemberOverview(): Promise<MemberOverview> {
  try {
    const res = await memberApiClient.get<Envelope<MemberOverview>>('/portal/overview');
    return res.data.data;
  } catch (error) {
    throw toMemberAuthServiceError(error);
  }
}

export async function fetchGymInfo(): Promise<MemberGymInfo> {
  try {
    const res = await memberApiClient.get<Envelope<MemberGymInfo>>('/portal/gym');
    return res.data.data;
  } catch (error) {
    throw toMemberAuthServiceError(error);
  }
}
