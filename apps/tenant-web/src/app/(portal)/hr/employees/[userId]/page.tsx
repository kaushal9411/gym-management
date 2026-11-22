'use client';

import { useParams } from 'next/navigation';

import { EmployeeDetailPage } from '@/features/hr/components/employees/employee-detail-page';

export default function HrEmployeeDetailRoute() {
  const params = useParams<{ userId: string }>();
  return <EmployeeDetailPage userId={params.userId} />;
}
