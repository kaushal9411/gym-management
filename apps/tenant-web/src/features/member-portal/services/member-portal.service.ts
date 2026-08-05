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
