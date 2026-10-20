'use client';

import { Bell } from 'lucide-react';

import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { ListRow, PortalList, SectionCard } from '../kit';

/** Profile entry point to the promotional opt-out page. */
export function NotificationPrefsLink() {
  return (
    <SectionCard title="Notifications" subtitle="Promotions by push, email, SMS and WhatsApp" icon={Bell} tone="info" flush>
      <PortalList>
        <ListRow icon={Bell} tone="info" title="Notification preferences" subtitle="Choose which promotions you get" href={MEMBER_PORTAL_ROUTES.notificationPreferences} />
      </PortalList>
    </SectionCard>
  );
}
