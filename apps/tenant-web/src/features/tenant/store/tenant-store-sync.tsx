'use client';

import * as React from 'react';

import { useAppDispatch } from '@/store/hooks';
import { useTenant } from '../tenant-provider';
import { tenantSynced } from './tenant-slice';

/** Hydrates the read-only Redux tenant mirror from the tenant context (re-syncs when a refresh changes it). */
export function TenantStoreSync() {
  const tenant = useTenant();
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(tenantSynced(tenant));
  }, [dispatch, tenant]);

  return null;
}
