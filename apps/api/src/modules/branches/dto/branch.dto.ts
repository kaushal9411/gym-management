export interface OperatingHoursDay {
  open?: string | null;
  close?: string | null;
  closed?: boolean;
}

export interface OperatingHours {
  monday?: OperatingHoursDay;
  tuesday?: OperatingHoursDay;
  wednesday?: OperatingHoursDay;
  thursday?: OperatingHoursDay;
  friday?: OperatingHoursDay;
  saturday?: OperatingHoursDay;
  sunday?: OperatingHoursDay;
}

export interface BranchHoliday {
  date: string;
  label?: string;
}

export interface BranchDto {
  id: string;
  name: string;
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
  operatingHours: OperatingHours | null;
  holidays: BranchHoliday[] | null;
  capacity: number | null;
  maxMembers: number | null;
  maxStaff: number | null;
  allowCheckIn: boolean;
  notes: string | null;
  isDefault: boolean;
  isActive: boolean;
  timezone: string;
  memberCount: number;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListBranchesQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  includeDeleted: boolean;
  sortBy: 'name' | 'branchCode' | 'city' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface BranchFieldsInput {
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
  operatingHours?: OperatingHours;
  holidays?: BranchHoliday[];
  capacity?: number;
  maxMembers?: number;
  maxStaff?: number;
  allowCheckIn?: boolean;
  notes?: string;
}

export interface CreateBranchInput extends BranchFieldsInput {
  name: string;
  branchCode?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateBranchInput extends BranchFieldsInput {
  name?: string;
  branchCode?: string;
}
