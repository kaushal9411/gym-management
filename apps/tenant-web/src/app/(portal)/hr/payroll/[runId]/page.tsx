'use client';

import { useParams } from 'next/navigation';

import { PayrollRunPage } from '@/features/hr/components/payroll/payroll-run-page';

export default function HrPayrollRunRoute() {
  const params = useParams<{ runId: string }>();
  return <PayrollRunPage runId={params.runId} />;
}
