import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage engine — client-only, see persist.ts

import { authReducer } from '@/features/auth/store/auth-slice';
import { branchReducer } from '@/features/branch/store/branch-slice';
import { dashboardReducer } from '@/features/dashboard/store/dashboard-slice';
import { navigationReducer } from '@/features/navigation/store/navigation-slice';
import { notificationReducer } from '@/features/notifications/store/notification-slice';
import { tenantReducer } from '@/features/tenant/store/tenant-slice';
import { themeReducer } from '@/features/theme/store/theme-slice';
import { uiReducer } from './ui-slice';

/**
 * Only the auth slice is persisted, and only a subset of it — transient UI
 * fields (status/error/pendingChallenge/bootstrapping) are blacklisted so a
 * reload never resumes mid-"loading" or showing a stale error. `ui` is
 * request-tracking scaffolding and is never persisted.
 *
 * SECURITY TRADEOFF (documented, not accidental): access + refresh tokens
 * live in this persisted slice, i.e. in localStorage. The architecturally
 * "correct" alternative — access token in memory only, refresh token in an
 * httpOnly cookie — runs into real friction here because the tenant portal
 * and the API are on different origins in dev (`{slug}.localhost:3001` vs
 * `localhost:4000`), which needs `SameSite=None; Secure` cookies that don't
 * behave consistently over plain HTTP across every browser. Until the app
 * is served through the same origin (or HTTPS end-to-end) to make that
 * cookie flow reliable, tokens are persisted here so sessions survive a
 * refresh — a known, accepted XSS-surface tradeoff for this phase.
 */
const authPersistConfig = {
  key: 'auth',
  storage,
  blacklist: ['status', 'error', 'pendingChallenge', 'bootstrapping'],
};

/** Sidebar-collapsed + last-picked branch are genuine user preferences worth surviving a reload. */
const navigationPersistConfig = { key: 'navigation', storage };
const branchPersistConfig = { key: 'branch', storage };

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  ui: uiReducer,
  navigation: persistReducer(navigationPersistConfig, navigationReducer),
  branch: persistReducer(branchPersistConfig, branchReducer),
  // theme and tenant are deliberately NOT persisted — both are read-only
  // mirrors of another source of truth (next-themes' own storage, and the
  // server-resolved TenantProvider context respectively); persisting them
  // here would risk a stale copy disagreeing with that source after a
  // browser restart. notifications/dashboard are ephemeral UI state that
  // doesn't need to survive a reload either.
  theme: themeReducer,
  tenant: tenantReducer,
  notifications: notificationReducer,
  dashboard: dashboardReducer,
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/**
 * Non-React consumers (the axios client's interceptors run outside any
 * component tree) need synchronous access to the current token/tenant
 * state. `AppProviders` registers the one store instance it creates here
 * once, on mount — this app is entirely client-rendered for auth, so a
 * single instance per browser tab is correct and matches how the rest of
 * the SPA already behaves.
 */
let activeStore: AppStore | null = null;

export function registerActiveStore(store: AppStore): void {
  activeStore = store;
}

export function getActiveStore(): AppStore | null {
  return activeStore;
}
