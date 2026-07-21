'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRoles } from '../hooks/use-iam';

interface RoleMultiSelectProps {
  selected: string[];
  onChange: (roleIds: string[]) => void;
  disabled?: boolean;
}

/** Multi-role picker — SUPER_ADMIN is platform-plane and never offered; inactive roles are hidden. */
export function RoleMultiSelect({ selected, onChange, disabled }: RoleMultiSelectProps) {
  const roles = useRoles();

  if (roles.isPending) return <Skeleton className="h-24 w-full" />;
  const assignable = (roles.data ?? []).filter((r) => r.name !== 'SUPER_ADMIN' && r.isActive);

  const toggle = (roleId: string, checked: boolean) => {
    onChange(checked ? [...selected, roleId] : selected.filter((id) => id !== roleId));
  };

  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
      {assignable.map((role) => (
        <div key={role.id} className="flex items-start gap-2">
          <Checkbox
            id={`role-${role.id}`}
            checked={selected.includes(role.id)}
            disabled={disabled}
            onCheckedChange={(checked) => toggle(role.id, checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor={`role-${role.id}`} className="cursor-pointer font-normal leading-snug">
            {role.name}
            {role.isSystem ? <span className="ml-1 text-xs text-muted-foreground">(system)</span> : null}
            {role.description ? <span className="block text-xs text-muted-foreground">{role.description}</span> : null}
          </Label>
        </div>
      ))}
    </div>
  );
}
