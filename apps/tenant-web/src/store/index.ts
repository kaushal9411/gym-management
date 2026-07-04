import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/store/auth-slice';

/**
 * Redux owns CLIENT state only (auth/session UI state, later: active branch,
 * sidebar, filters). Server state belongs to TanStack Query — never mirror it
 * here. A factory (not a singleton) so each SSR request gets a fresh store.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
