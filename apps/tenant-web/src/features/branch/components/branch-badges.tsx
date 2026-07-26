import { Badge } from '@/components/ui/badge';

export function BranchStatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? 'default' : 'outline'}>{isActive ? 'Active' : 'Inactive'}</Badge>;
}

export function BranchDefaultBadge({ isDefault }: { isDefault: boolean }) {
  if (!isDefault) return null;
  return <Badge variant="secondary">Default</Badge>;
}
