import type { Paginated } from '@/features/iam/types';

export type { Paginated };

export type WeekDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type ClassSessionStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type ClassBookingStatus = 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export const WEEK_DAYS: WeekDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export interface ScheduleSlot {
  dayOfWeek: WeekDay;
  startTime: string;
}

export interface GroupClass {
  id: string;
  name: string;
  description: string | null;
  trainer: { id: string; name: string } | null;
  branch: { id: string; name: string };
  capacity: number;
  durationMinutes: number;
  isActive: boolean;
  schedule: ScheduleSlot[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateGroupClassPayload {
  name: string;
  description?: string;
  trainerId?: string;
  branchId: string;
  capacity: number;
  durationMinutes: number;
  isActive?: boolean;
}

export interface UpdateGroupClassPayload {
  name?: string;
  description?: string;
  trainerId?: string | null;
  branchId?: string;
  capacity?: number;
  durationMinutes?: number;
  isActive?: boolean;
}

export interface ListGroupClassesParams {
  page: number;
  limit: number;
  branchId?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface ClassSession {
  id: string;
  groupClass: { id: string; name: string };
  branch: { id: string; name: string };
  trainer: { id: string; name: string } | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: ClassSessionStatus;
}

export interface ClassBooking {
  id: string;
  member: { id: string; memberId: string; name: string };
  status: ClassBookingStatus;
  bookedByRole: string;
  bookedAt: string;
  cancelledAt: string | null;
}

export interface ClassSessionDetail extends ClassSession {
  bookings: ClassBooking[];
}

export interface ListSessionsParams {
  branchId?: string;
  groupClassId?: string;
  dateFrom: string;
  dateTo: string;
}
