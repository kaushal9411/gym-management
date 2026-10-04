'use client';

import { MeasurementsPageContent } from '@/features/member-portal/components/training/measurements-page-content';

/** Read-only — a member never edits their own measurements; only a trainer/owner/manager logs them (staff-side Member Detail page). */
export default function MemberMeasurementsPage() {
  return <MeasurementsPageContent />;
}
