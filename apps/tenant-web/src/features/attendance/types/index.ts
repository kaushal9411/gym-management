import type { Paginated } from '@/features/iam/types';

export type AttendanceMethod = 'QR_CODE' | 'MANUAL' | 'BIOMETRIC' | 'FACE_RECOGNITION' | 'NFC' | 'RFID';
export type AttendanceStatus = 'CHECKED_IN' | 'CHECKED_OUT';

export interface AttendanceMemberSummary {
  id: string;
  memberId: string;
  name: string;
  profilePhotoUrl: string | null;
}

export interface AttendanceBranchSummary {
  id: string;
  name: string;
}

export interface AttendanceRecord {
  id: string;
  member: AttendanceMemberSummary;
  branch: AttendanceBranchSummary;
  checkInTime: string;
  checkOutTime: string | null;
  attendanceDate: string;
  method: AttendanceMethod;
  deviceName: string | null;
  deviceId: string | null;
  status: AttendanceStatus;
  notes: string | null;
  checkedInBy: { id: string; name: string } | null;
  checkedOutBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CheckInPayload {
  memberId: string;
  branchId?: string;
  method?: AttendanceMethod;
  deviceName?: string;
  deviceId?: string;
  notes?: string;
}

export interface CheckOutPayload {
  memberId?: string;
  attendanceId?: string;
  deviceName?: string;
  deviceId?: string;
  notes?: string;
}

export interface QrValidationResult {
  valid: boolean;
  reason: string | null;
  member: (AttendanceMemberSummary & { branchId: string; status: string }) | null;
  alreadyCheckedIn: boolean;
}

export interface ListAttendanceParams {
  page: number;
  limit: number;
  search?: string;
  branchId?: string;
  memberId?: string;
  status?: AttendanceStatus;
  method?: AttendanceMethod;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
  sortBy?: 'checkInTime' | 'attendanceDate' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface UpdateAttendancePayload {
  checkInTime?: string;
  checkOutTime?: string | null;
  notes?: string;
  status?: AttendanceStatus;
}

export interface AttendanceSummary {
  totalCheckInsToday: number;
  totalCheckOutsToday: number;
  currentlyInside: number;
  peakCheckInHour: number | null;
  trend: Array<{ date: string; count: number }>;
}

export type PaginatedAttendance = Paginated<AttendanceRecord>;
