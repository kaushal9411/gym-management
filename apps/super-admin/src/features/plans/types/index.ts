export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  trialDays: number;
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxReceptionists: number;
  maxStaff: number;
  maxMembers: number;
  maxStorageMb: number;
  isActive: boolean;
  sortOrder: number;
  features: PlanFeature[];
  _count?: { subscriptions: number };
}

export interface PlanSubscriber {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; status: string };
}

export interface UpsertPlanInput {
  slug: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxReceptionists: number;
  maxStaff: number;
  maxMembers: number;
  maxStorageMb: number;
  sortOrder: number;
  features: PlanFeature[];
}
