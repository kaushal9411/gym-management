import type { BusinessHours } from '@/features/gym-settings/types';

/** The plain shape `/branches/assignable` has always returned — the portal's branch selector and every `BranchSelect` dropdown depend on exactly this. */
export interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  timezone: string;
}

export interface BranchHoliday {
  date: string;
  label?: string;
}

export interface BranchDetail extends Branch {
  branchCode: string;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  operatingHours: BusinessHours | null;
  holidays: BranchHoliday[] | null;
  capacity: number | null;
  maxMembers: number | null;
  maxStaff: number | null;
  allowCheckIn: boolean;
  notes: string | null;
  memberCount: number;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BranchListResult {
  items: BranchDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListBranchesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'branchCode' | 'city' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface BranchFormFields {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  operatingHours?: BusinessHours;
  holidays?: BranchHoliday[];
  capacity?: number;
  maxMembers?: number;
  maxStaff?: number;
  allowCheckIn?: boolean;
  notes?: string;
}

export interface CreateBranchInput extends BranchFormFields {
  name: string;
  branchCode?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export type UpdateBranchInput = Partial<CreateBranchInput>;
