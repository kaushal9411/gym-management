import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { AnnouncementStatus } from '../types';

// Mirrors the app-wide semantic mapping used by other status badges
// (e.g. members/workouts/diet): live/active states get `success`, pending
// states get `secondary`, wound-down states get `outline`.
const STATUS_VARIANT: Record<AnnouncementStatus, NonNullable<BadgeProps['variant']>> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  PUBLISHED: 'success',
  EXPIRED: 'outline',
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
