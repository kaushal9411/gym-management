import type { Metadata } from 'next';

import { MaintenanceView } from '@/features/auth/components/status/maintenance-view';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return <MaintenanceView />;
}
