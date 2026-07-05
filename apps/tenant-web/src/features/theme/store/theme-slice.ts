import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
}

const initialState: ThemeState = { preference: 'system' };

/**
 * A READ-ONLY mirror of next-themes' own state — next-themes already owns
 * persistence (its own localStorage key) and is the actual source of
 * truth; this slice exists only so non-component code (e.g. a future
 * chart's color palette picked outside React) can read the current theme
 * synchronously, the same reason `getActiveStore()` exists at all. Kept
 * out of redux-persist's blacklist... no — kept OUT of persistence
 * entirely (see store/index.ts) to avoid two sources of truth disagreeing
 * after a browser restart.
 */
const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    themePreferenceSynced(state, action: PayloadAction<ThemePreference>) {
      state.preference = action.payload;
    },
  },
});

export const { themePreferenceSynced } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
