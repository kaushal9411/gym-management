import type { MemberInvoiceStatus, MemberPaymentMethod, MemberPaymentStatus } from '@prisma/client';

import type { PublicBusinessHour } from '../utils/member-overview.util';

/** Money = decimal strings, counts = numbers, dates = 'YYYY-MM-DD' (UTC). */
export interface MemberOverviewDto {
  member: {
    id: string;
    memberId: string;
    name: string;
    photoUrl: string | null;
    joiningDate: string;
    branch: { id: string; name: string } | null;
    trainer: { id: string; name: string } | null;
  };
  membership: {
    planName: string;
    status: string;
    startDate: string;
    endDate: string;
    daysLeft: number;
    expired: boolean;
    totalDays: number;
    /** Plan-priced: priceAtAssignment with the plan's CURRENT discount% then tax% (same formula as renewal checkout). */
    price: string | null;
    /** Settled (SUCCESS + PARTIALLY_REFUNDED) payments linked to this membership directly or via its invoices. */
    amountPaid: string | null;
  } | null;
  attendance: {
    thisMonth: { visits: number; previous: number };
    currentStreakDays: number;
    bestStreakDays: number;
    totalVisits: number;
    avgVisitMinutes: number | null;
    lastVisitAt: string | null;
    weekday: { weekday: number; count: number }[];
    daily: { date: string; visits: number }[];
  };
  workout: {
    planName: string;
    progressPercent: number;
    completedExercises: number;
    totalExercises: number;
    completedThisWeek: number;
  } | null;
  diet: {
    planName: string;
    dailyCalories: number | null;
    loggedToday: boolean;
    waterTodayMl: number | null;
    latestWeightKg: string | null;
  } | null;
  billing: {
    outstanding: { value: string; invoiceCount: number };
    nextDueDate: string | null;
    paidLast90Days: { value: string; count: number };
  };
  classes: {
    upcoming: {
      sessionId: string;
      name: string;
      date: string;
      startTime: string;
      endTime: string;
      trainerName: string | null;
      bookingStatus: string;
    }[];
  };
  notifications: { unread: number };
}

export interface MemberPaymentItemDto {
  id: string;
  paymentNumber: string;
  amount: string;
  method: MemberPaymentMethod;
  status: MemberPaymentStatus;
  paymentDate: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  totalRefunded: string;
}

export interface MemberInvoiceDetailPortalDto {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: MemberInvoiceStatus;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  items: { description: string; quantity: number; unitPrice: string; amount: string }[];
  payments: {
    paymentNumber: string;
    finalAmount: string;
    status: MemberPaymentStatus;
    paymentDate: string;
  }[];
  paid: string;
  balance: string;
  branch: { name: string };
}

export interface MemberGymDto {
  name: string;
  logoUrl: string | null;
  address: {
    line1: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  businessHours: PublicBusinessHour[] | null;
  social: Record<string, string> | null;
  branch: {
    name: string;
    phone: string | null;
    email: string | null;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      postalCode: string | null;
    } | null;
    businessHours: PublicBusinessHour[] | null;
  } | null;
}
