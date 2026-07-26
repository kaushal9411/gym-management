import { Badge } from '@/components/ui/badge';
import type { AnnouncementStatus } from '../types';

const STATUS_VARIANT: Record<AnnouncementStatus, 'secondary' | 'outline' | 'default'> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  PUBLISHED: 'default',
  EXPIRED: 'outline',
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
