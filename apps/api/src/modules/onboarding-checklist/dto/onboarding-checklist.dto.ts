export interface OnboardingChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  actionUrl: string;
}

export interface OnboardingChecklistStatusDto {
  items: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
}
