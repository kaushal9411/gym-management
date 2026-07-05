export interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  category: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
