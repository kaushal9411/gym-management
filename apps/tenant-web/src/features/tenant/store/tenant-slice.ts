import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Tenant } from '../types';

/**
 * A READ-ONLY mirror of the server-resolved `TenantProvider` context — that
 * context (populated once per request in the root Server Component) stays
 * the actual source of truth so branding paints on first byte with no
 * flash; this slice exists only for non-component code (axios interceptors,
 * the Socket.IO/Pusher connection managers) that needs synchronous access
 * to tenant id/currency/timezone without a `useTenant()` hook. Never
 * persisted — always re-hydrated from the context on mount (see
 * `TenantStoreSync` in providers/app-providers.tsx).
 */
const tenantSlice = createSlice({
  name: 'tenant',
  initialState: null as Tenant | null,
  reducers: {
    tenantSynced(_state, action: PayloadAction<Tenant>) {
      return action.payload;
    },
  },
});

export const { tenantSynced } = tenantSlice.actions;
export const tenantReducer = tenantSlice.reducer;
