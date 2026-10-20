import { CommunicationsShell } from '@/features/communications/components/communications-shell';

export default function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  return <CommunicationsShell>{children}</CommunicationsShell>;
}
