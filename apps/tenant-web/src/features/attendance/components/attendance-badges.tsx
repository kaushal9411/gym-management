import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AttendanceMethod, AttendanceStatus } from '../types';

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CHECKED_OUT: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
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
  return <Badge className={cn('border-transparent font-medium', STATUS_STYLES[status])}>{status === 'CHECKED_IN' ? 'Checked in' : 'Checked out'}</Badge>;
}

export function AttendanceMethodBadge({ method }: { method: AttendanceMethod }) {
  return <Badge variant="secondary">{METHOD_LABELS[method]}</Badge>;
}
