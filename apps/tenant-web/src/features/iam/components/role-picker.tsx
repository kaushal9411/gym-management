'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { RoleDto } from '../types';
import { displayRoleName, roleBlurb } from './users-overview';

const ROLE_TONES: Accent[] = ['primary', 'aqua', 'violet', 'success', 'warning', 'destructive'];

interface RolePickerProps {
  roles: RoleDto[] | undefined;
  loading: boolean;
  /** Which roles may be offered at all (the caller decides: invite hides OWNER, create-user does not). */
  filter: (role: RoleDto) => boolean;
  selected: string[];
  onChange: (roleIds: string[]) => void;
  /** `single` behaves like radio cards (invite modal); `multi` toggles (create-user form). */
  mode: 'single' | 'multi';
  disabled?: boolean;
  invalid?: boolean;
  label: string;
}

/** Selectable role cards: name, one-line description, permission count. Replaces the native select / checkbox list. */
export function RolePicker({ roles, loading, filter, selected, onChange, mode, disabled, invalid, label }: RolePickerProps) {
  if (loading) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }
  const list = (roles ?? []).filter(filter);

  const toggle = (id: string) => {
    if (mode === 'single') onChange(selected[0] === id ? [] : [id]);
    else onChange(selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]);
  };

  return (
    <div role="group" aria-label={label} className="grid gap-2.5 sm:grid-cols-2">
      {list.map((role, i) => {
        const tone = ROLE_TONES[i % ROLE_TONES.length]!;
        const on = selected.includes(role.id);
        return (
          <motion.button
            key={role.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggle(role.id)}
            className="relative flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition-shadow disabled:opacity-50"
            style={{
              borderColor: on ? accentVar(tone) : invalid ? 'var(--destructive)' : 'var(--border)',
              backgroundImage: on ? `linear-gradient(160deg, ${tint(tone, 12)}, transparent)` : undefined,
              boxShadow: on ? `0 14px 26px -16px ${accentVar(tone)}` : undefined,
            }}
          >
            <motion.span
              initial={false}
              animate={{ scale: on ? 1 : 0 }}
              className={`absolute right-2.5 top-2.5 grid size-[22px] place-items-center text-white ${mode === 'multi' ? 'rounded-lg' : 'rounded-full'}`}
              style={{ backgroundColor: accentVar(tone) }}
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
            <b className="pr-7 text-[14.5px] font-extrabold">{displayRoleName(role.name)}</b>
            <span className="min-h-8 text-xs leading-snug text-muted-foreground">{roleBlurb(role)}</span>
            <span className="text-[11px] font-bold" style={{ color: accentVar(tone) }}>
              {role.permissions.length} permissions
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
