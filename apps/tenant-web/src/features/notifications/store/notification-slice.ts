import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface NotificationUiState {
  panelOpen: boolean;
  /** Mirrors the TanStack Query unread count for the header badge, updated instantly by the Socket.IO `notification:new` event without waiting for a refetch. */
  unreadCount: number;
}

const initialState: NotificationUiState = { panelOpen: false, unreadCount: 0 };

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    notificationPanelOpened(state) {
      state.panelOpen = true;
    },
    notificationPanelClosed(state) {
      state.panelOpen = false;
    },
    notificationPanelToggled(state) {
      state.panelOpen = !state.panelOpen;
    },
    unreadCountSet(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    unreadCountIncremented(state) {
      state.unreadCount += 1;
    },
  },
});

export const {
  notificationPanelOpened,
  notificationPanelClosed,
  notificationPanelToggled,
  unreadCountSet,
  unreadCountIncremented,
} = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;
