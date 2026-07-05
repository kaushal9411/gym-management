import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type DashboardDateRange = '7d' | '30d' | '90d';

interface DashboardUiState {
  /** Widget/chart data itself lives in TanStack Query — this is just the shared date-range filter every chart on the page reads. */
  dateRange: DashboardDateRange;
}

const initialState: DashboardUiState = { dateRange: '30d' };

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    dateRangeChanged(state, action: PayloadAction<DashboardDateRange>) {
      state.dateRange = action.payload;
    },
  },
});

export const { dateRangeChanged } = dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;
