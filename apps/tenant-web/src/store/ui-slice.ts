import { createSlice } from '@reduxjs/toolkit';

interface UiState {
  /** Count of in-flight API requests — drives the top progress bar. */
  pendingRequests: number;
}

const initialState: UiState = { pendingRequests: 0 };

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
  },
});

export const { requestStarted, requestFinished } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
