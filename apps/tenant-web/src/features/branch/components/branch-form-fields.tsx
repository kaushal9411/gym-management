'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusinessHoursEditor } from '@/features/gym-settings/components/business-hours-editor';
import type { BusinessHours } from '@/features/gym-settings/types';
import { HolidaysEditor } from './holidays-editor';
import type { BranchHoliday } from '../types';

export interface BranchFormState {
  name: string;
  branchCode: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  operatingHours: BusinessHours;
  holidays: BranchHoliday[];
  capacity: string;
  maxMembers: string;
  maxStaff: string;
  allowCheckIn: boolean;
  notes: string;
}

export const DEFAULT_BRANCH_FORM_STATE: BranchFormState = {
  name: '',
  branchCode: '',
  email: '',
  phone: '',
  whatsappNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  latitude: '',
  longitude: '',
  timezone: '',
  operatingHours: {},
  holidays: [],
  capacity: '',
  maxMembers: '',
  maxStaff: '',
  allowCheckIn: true,
  notes: '',
};

interface BranchFormFieldsProps {
  value: BranchFormState;
  onChange: (value: BranchFormState) => void;
  disabled?: boolean;
  /** The Branch Code is auto-generated at create time — only editable once the branch already exists. */
  isEditing?: boolean;
}

export function BranchFormFields({ value, onChange, disabled, isEditing }: BranchFormFieldsProps) {
  const set = <K extends keyof BranchFormState>(key: K, fieldValue: BranchFormState[K]) => onChange({ ...value, [key]: fieldValue });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Branch Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="branchName" required>Branch Name</Label>
            <Input id="branchName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchCode">Branch Code</Label>
            <Input
              id="branchCode"
              value={value.branchCode}
              disabled={disabled || !isEditing}
              placeholder={isEditing ? undefined : 'Auto-generated'}
              onChange={(e) => set('branchCode', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchEmail">Email</Label>
            <Input id="branchEmail" type="email" value={value.email} disabled={disabled} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchPhone">Phone</Label>
            <Input id="branchPhone" value={value.phone} disabled={disabled} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchWhatsapp">WhatsApp Number</Label>
            <Input id="branchWhatsapp" value={value.whatsappNumber} disabled={disabled} onChange={(e) => set('whatsappNumber', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchTimezone">Timezone</Label>
            <Input id="branchTimezone" value={value.timezone} disabled={disabled} placeholder="e.g. America/New_York" onChange={(e) => set('timezone', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branchAddress1">Address Line 1</Label>
            <Input id="branchAddress1" value={value.addressLine1} disabled={disabled} onChange={(e) => set('addressLine1', e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branchAddress2">Address Line 2</Label>
            <Input id="branchAddress2" value={value.addressLine2} disabled={disabled} onChange={(e) => set('addressLine2', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchCity">City</Label>
            <Input id="branchCity" value={value.city} disabled={disabled} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchState">State</Label>
            <Input id="branchState" value={value.state} disabled={disabled} onChange={(e) => set('state', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchCountry">Country</Label>
            <Input id="branchCountry" value={value.country} disabled={disabled} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchPostalCode">Postal Code</Label>
            <Input id="branchPostalCode" value={value.postalCode} disabled={disabled} onChange={(e) => set('postalCode', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchLatitude">Latitude</Label>
            <Input id="branchLatitude" type="number" step="0.000001" value={value.latitude} disabled={disabled} onChange={(e) => set('latitude', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchLongitude">Longitude</Label>
            <Input id="branchLongitude" type="number" step="0.000001" value={value.longitude} disabled={disabled} onChange={(e) => set('longitude', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Operating Hours</h3>
        <BusinessHoursEditor value={value.operatingHours} onChange={(v) => set('operatingHours', v)} disabled={disabled} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Holidays</h3>
        <HolidaysEditor value={value.holidays} onChange={(v) => set('holidays', v)} disabled={disabled} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Branch Settings</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="branchCapacity">Capacity</Label>
            <Input id="branchCapacity" type="number" min={0} value={value.capacity} disabled={disabled} onChange={(e) => set('capacity', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchMaxMembers">Maximum Members</Label>
            <Input id="branchMaxMembers" type="number" min={0} value={value.maxMembers} disabled={disabled} onChange={(e) => set('maxMembers', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchMaxStaff">Maximum Staff</Label>
            <Input id="branchMaxStaff" type="number" min={0} value={value.maxStaff} disabled={disabled} onChange={(e) => set('maxStaff', e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox id="branchAllowCheckIn" checked={value.allowCheckIn} disabled={disabled} onCheckedChange={(v) => set('allowCheckIn', v === true)} />
          Allow Check-in
        </label>
        <div className="space-y-2">
          <Label htmlFor="branchNotes">Notes</Label>
          <textarea
            id="branchNotes"
            value={value.notes}
            disabled={disabled}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </section>
    </div>
  );
}
