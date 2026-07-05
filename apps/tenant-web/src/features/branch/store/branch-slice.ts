import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface BranchState {
  /** The staff member's currently-selected branch — persisted so it survives a reload. Actual branch data lives in TanStack Query. */
  currentBranchId: string | null;
}

const initialState: BranchState = {
  currentBranchId: null,
};

const branchSlice = createSlice({
  name: 'branch',
  initialState,
  reducers: {
    branchSelected(state, action: PayloadAction<string>) {
      state.currentBranchId = action.payload;
    },
  },
});

export const { branchSelected } = branchSlice.actions;
export const branchReducer = branchSlice.reducer;
