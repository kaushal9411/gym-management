import { HrShell } from '@/features/hr/components/hr-shell';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return <HrShell>{children}</HrShell>;
}
