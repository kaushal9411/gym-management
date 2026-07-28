import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { AttendanceMethod, AttendanceStatus } from '../types';

const STATUS_VARIANT: Record<AttendanceStatus, NonNullable<BadgeProps['variant']>> = {
  CHECKED_IN: 'success',
  CHECKED_OUT: 'secondary',
};

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  QR_CODE: 'QR Code',
  MANUAL: 'Manual',
  BIOMETRIC: 'Biometric',
  FACE_RECOGNITION: 'Face Recognition',
  NFC: 'NFC',
  RFID: 'RFID',
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]} className="font-medium">{status === 'CHECKED_IN' ? 'Checked in' : 'Checked out'}</Badge>;
}

export function AttendanceMethodBadge({ method }: { method: AttendanceMethod }) {
  return <Badge variant="secondary">{METHOD_LABELS[method]}</Badge>;
}
