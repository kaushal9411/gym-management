'use client';

import * as React from 'react';

import { useAppSelector } from '@/store/hooks';
import type { UserRole } from '../types';

/**
 * Permission Based Access Control — pairs with the role checks below for
 * PBAC + RBAC. Mirrors the backend's permission-key catalog exactly
 * (`resource:action`, e.g. `members:read`) so the same keys used in
 * `<RequirePermission>` map 1:1 to what the API enforces server-side.
 */
export function usePermissions() {
  const permissions = useAppSelector((state) => state.auth.permissions);
  const roles = useAppSelector((state) => state.auth.user?.roles ?? []);

  const hasPermission = React.useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );
  const hasAnyPermission = React.useCallback(
    (required: string[]) => required.some((p) => permissions.includes(p)),
    [permissions],
  );
  const hasAllPermissions = React.useCallback(
    (required: string[]) => required.every((p) => permissions.includes(p)),
    [permissions],
  );
  const hasRole = React.useCallback((role: UserRole) => roles.includes(role), [roles]);
  const hasAnyRole = React.useCallback((required: UserRole[]) => required.some((r) => roles.includes(r)), [roles]);

  return { permissions, roles, hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole };
}
