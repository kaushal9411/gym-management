import { Badge } from '@/components/ui/badge';
import type { AttendanceDeviceVendor } from '../types';

export function AttendanceDeviceStatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Disabled'}</Badge>;
}

const VENDOR_LABELS: Record<AttendanceDeviceVendor, string> = {
  ZKTECO: 'ZKTeco',
  ESSL: 'eSSL',
  GENERIC: 'Generic',
  OTHER: 'Other',
};

export function AttendanceDeviceVendorBadge({ vendor }: { vendor: AttendanceDeviceVendor }) {
  return <Badge variant="outline">{VENDOR_LABELS[vendor]}</Badge>;
}
