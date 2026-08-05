export interface CreateGroupClassInput {
  name: string;
  description?: string;
  trainerId?: string;
  branchId: string;
  capacity: number;
  durationMinutes: number;
  isActive?: boolean;
}

export interface UpdateGroupClassInput {
  name?: string;
  description?: string;
  trainerId?: string | null;
  branchId?: string;
  capacity?: number;
  durationMinutes?: number;
  isActive?: boolean;
}

export type WeekDayName = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface ScheduleSlotInput {
  dayOfWeek: WeekDayName;
  startTime: string; // "HH:mm"
}

export interface ListGroupClassesQuery {
  page: number;
  limit: number;
  branchId?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  search?: string;
  sortBy: 'name' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface GroupClassDto {
  id: string;
  name: string;
  description: string | null;
  trainer: { id: string; name: string } | null;
  branch: { id: string; name: string };
  capacity: number;
  durationMinutes: number;
  isActive: boolean;
  schedule: ScheduleSlotInput[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListSessionsQuery {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
  groupClassId?: string;
}

export interface ClassSessionDto {
  id: string;
  groupClass: { id: string; name: string };
  branch: { id: string; name: string };
  trainer: { id: string; name: string } | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: string;
}

export interface ClassSessionDetailDto extends ClassSessionDto {
  bookings: ClassBookingDto[];
}

export interface ClassBookingDto {
  id: string;
  member: { id: string; memberId: string; name: string };
  status: string;
  bookedByRole: string;
  bookedAt: string;
  cancelledAt: string | null;
}
