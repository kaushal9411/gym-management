export type BillingErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'COUPON_INVALID'
  | 'PAYMENT_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNKNOWN';

export class BillingServiceError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BillingServiceError';
  }
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaymentProvider = 'stripe' | 'razorpay' | 'paypal';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'GRACE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';

export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
}

export interface PlanLimits {
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxReceptionists: number;
  maxStaff: number;
  maxMembers: number;
  maxStorageMb: number;
}

export interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  sortOrder: number;
  limits: PlanLimits;
  features: PlanFeature[];
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  plan: SubscriptionPlan;
}

export interface SubscriptionHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  note: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  gatewayReference: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface BillingAddress {
  legalName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId?: string | null;
}

export interface CouponValidationResult {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TRIAL_EXTENSION';
  scope: 'ONE_TIME' | 'RECURRING' | 'REFERRAL';
  discountAmount: number;
  trialExtensionDays: number;
  finalAmount: number;
}

export interface CheckoutPayload {
  planSlug: string;
  billingCycle: BillingCycle;
  couponCode?: string;
  provider?: PaymentProvider;
  paymentToken?: string;
}

export interface CheckoutResult {
  subscription: Subscription;
  invoice: Invoice;
  plan: SubscriptionPlan;
}
