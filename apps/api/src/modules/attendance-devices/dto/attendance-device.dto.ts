import type { AttendanceDeviceVendor } from '@prisma/client';

export interface AttendanceDeviceDto {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  vendor: AttendanceDeviceVendor;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Only returned once, on create/regenerate — never again afterward. */
export interface AttendanceDeviceWithKeyDto extends AttendanceDeviceDto {
  apiKey: string;
}

export interface ListAttendanceDevicesQuery {
  branchId?: string;
  isActive?: boolean;
}

export interface CreateAttendanceDeviceInput {
  branchId: string;
  name: string;
  vendor?: AttendanceDeviceVendor;
}

export interface UpdateAttendanceDeviceInput {
  name?: string;
  vendor?: AttendanceDeviceVendor;
  isActive?: boolean;
}

/** Normalized punch shape every vendor adapter in the bridge agent must translate its own protocol into — see the AttendanceDevice model's doc comment. */
export interface DevicePunchInput {
  deviceUserId: string;
  timestamp?: string;
  direction?: 'IN' | 'OUT';
}
