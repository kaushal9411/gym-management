import { createSlice } from '@reduxjs/toolkit';

interface UiState {
  /** Count of in-flight API requests — drives the top progress bar. */
  pendingRequests: number;
  /** True while an App Router navigation (Link/sidebar/breadcrumb/back-forward) is in flight — a second, independent signal into the same top progress bar. */
  navigationPending: boolean;
}

const initialState: UiState = { pendingRequests: 0, navigationPending: false };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    requestStarted(state) {
      state.pendingRequests += 1;
    },
    requestFinished(state) {
      state.pendingRequests = Math.max(0, state.pendingRequests - 1);
    },
    navigationStarted(state) {
      state.navigationPending = true;
    },
    navigationFinished(state) {
      state.navigationPending = false;
    },
  },
});

export const { requestStarted, requestFinished, navigationStarted, navigationFinished } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
