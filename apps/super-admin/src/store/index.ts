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
import storage from 'redux-persist/lib/storage';

import { authReducer } from '@/features/auth/store/auth-slice';

/**
 * Same documented tradeoff as tenant-web's store (access + refresh tokens
 * in localStorage, not httpOnly cookies) — see that file's comment for the
 * full rationale. `status`/`error`/`bootstrapping` are excluded so a reload
 * never resumes mid-"loading" (the exact bug fixed in tenant-web's
 * selectIsAuthenticated — this store follows the same rule from day one).
 */
const authPersistConfig = {
  key: 'admin-auth',
  storage,
  blacklist: ['status', 'error', 'bootstrapping'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

let activeStore: AppStore | null = null;

export function registerActiveStore(store: AppStore): void {
  activeStore = store;
}

export function getActiveStore(): AppStore | null {
  return activeStore;
}
