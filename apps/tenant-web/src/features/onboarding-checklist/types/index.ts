export interface OnboardingChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  actionUrl: string;
}

export interface OnboardingChecklistStatus {
  items: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
}
