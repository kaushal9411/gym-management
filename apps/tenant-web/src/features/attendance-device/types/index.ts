export type AttendanceDeviceVendor = 'ZKTECO' | 'ESSL' | 'GENERIC' | 'OTHER';

export interface AttendanceDevice {
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

/** Only ever present right after create/regenerate — never returned again afterward. */
export interface AttendanceDeviceWithKey extends AttendanceDevice {
  apiKey: string;
}

export interface ListAttendanceDevicesParams {
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
