'use client';

import * as React from 'react';

import { useAppDispatch } from '@/store/hooks';
import type { Tenant } from '../types';
import { tenantSynced } from './tenant-slice';

/** Hydrates the read-only Redux tenant mirror from the server-resolved context once on mount. */
export function TenantStoreSync({ tenant }: { tenant: Tenant }) {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(tenantSynced(tenant));
  }, [dispatch, tenant]);

  return null;
}
