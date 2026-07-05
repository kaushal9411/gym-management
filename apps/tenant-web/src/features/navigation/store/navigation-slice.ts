import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface NavigationState {
  /** Desktop sidebar collapsed to icon-only rail. */
  sidebarCollapsed: boolean;
  /** Mobile/tablet slide-over sidebar visibility — never persisted, always closed on load. */
  mobileSidebarOpen: boolean;
}

const initialState: NavigationState = {
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    sidebarCollapsedSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    mobileSidebarOpened(state) {
      state.mobileSidebarOpen = true;
    },
    mobileSidebarClosed(state) {
      state.mobileSidebarOpen = false;
    },
  },
});

export const { sidebarToggled, sidebarCollapsedSet, mobileSidebarOpened, mobileSidebarClosed } = navigationSlice.actions;
export const navigationReducer = navigationSlice.reducer;
