import { MemberAuthProvider } from '@/providers/member-auth-provider';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <MemberAuthProvider>{children}</MemberAuthProvider>;
}
