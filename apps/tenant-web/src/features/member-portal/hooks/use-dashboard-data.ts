'use client';

import * as React from 'react';

import { localDateKey } from '../lib/format';
import type { MemberOverview, MemberPortalAttendanceItem, MemberPortalBooking, MemberPortalDiet, MemberPortalInvoice, MemberPortalProfile, MemberPortalWorkout } from '../services/member-portal.service';
import { useMemberAttendance, useMemberBookings, useMemberDiet, useMemberInvoices, useMemberOverview, useMemberProfile, useMemberWorkout } from './use-member-portal';

const DAY = 86_400_000;
const keyOf = (iso: string) => iso.slice(0, 10);

function streaks(dates: Set<string>): { current: number; best: number } {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = new Date(`${d}T00:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  // current: consecutive days ending today (or yesterday - today's visit may not have happened yet)
  let cursor = new Date();
  if (!dates.has(localDateKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let current = 0;
  while (dates.has(localDateKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return { current, best };
}

/** Builds an overview-shaped object from the per-resource endpoints (used only when `/portal/overview` is unavailable). */
export function buildFallbackOverview(args: {
  profile: MemberPortalProfile;
  attendance: { items: MemberPortalAttendanceItem[]; total: number } | undefined;
  workout: MemberPortalWorkout | null | undefined;
  diet: MemberPortalDiet | null | undefined;
  invoices: MemberPortalInvoice[];
  bookings: MemberPortalBooking[];
}): MemberOverview {
  const { profile, attendance, workout, diet, invoices, bookings } = args;
  const items = attendance?.items ?? [];
  const perDay = new Map<string, number>();
  for (const it of items) perDay.set(keyOf(it.attendanceDate), (perDay.get(keyOf(it.attendanceDate)) ?? 0) + 1);
  const now = new Date();
  const daily = Array.from({ length: 84 }, (_, i) => {
    const date = localDateKey(new Date(now.getTime() - (83 - i) * DAY));
    return { date, visits: perDay.get(date) ?? 0 };
  });
  const weekday = Array.from({ length: 7 }, (_, w) => ({ weekday: w, count: 0 }));
  for (const d of daily) weekday[new Date(`${d.date}T00:00:00`).getDay()]!.count += d.visits;
  const monthKey = localDateKey(now).slice(0, 7);
  const prevMonth = localDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const visitsIn = (mk: string) => items.filter((i) => keyOf(i.attendanceDate).startsWith(mk)).length;
  const { current, best } = streaks(new Set(perDay.keys()));
  const mins = items.filter((i) => i.checkOutTime).map((i) => (new Date(i.checkOutTime!).getTime() - new Date(i.checkInTime).getTime()) / 60_000).filter((n) => n > 0 && n < 600);

  const ms = profile.currentMembership;
  const daysLeft = ms ? Math.ceil((new Date(ms.endDate).getTime() - Date.now()) / DAY) : 0;
  const done = workout?.progress.filter((p) => p.status === 'COMPLETED').length ?? 0;
  const total = workout?.workoutPlan.exercises.length ?? 0;
  const unpaid = invoices.filter((i) => i.status !== 'PAID');
  const today = localDateKey(now);
  const log = diet?.dailyLogs.find((l) => keyOf(l.date) === today);

  return {
    member: { id: profile.id, memberId: profile.memberId, name: profile.name, photoUrl: profile.profilePhotoUrl, joiningDate: profile.joiningDate, branch: profile.branch, trainer: profile.trainer },
    membership: ms ? { planName: ms.planName, status: ms.status, startDate: null, endDate: ms.endDate, daysLeft, totalDays: null, price: null, amountPaid: null, expired: daysLeft < 0 } : null,
    attendance: {
      thisMonth: { visits: visitsIn(monthKey), previous: visitsIn(prevMonth) },
      currentStreakDays: current,
      bestStreakDays: best,
      totalVisits: attendance?.total ?? items.length,
      avgVisitMinutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null,
      lastVisitAt: items[0]?.checkInTime ?? null,
      weekday,
      daily,
    },
    workout: workout ? { planName: workout.workoutPlan.name, progressPercent: total ? Math.round((done / total) * 100) : 0, completedExercises: done, totalExercises: total, completedThisWeek: 0 } : null,
    diet: diet ? { planName: diet.dietPlan.name, dailyCalories: diet.dietPlan.dailyCalories, loggedToday: Boolean(log), waterTodayMl: log?.waterIntakeMl ?? null, latestWeightKg: log?.weightKg ?? null } : null,
    billing: {
      outstanding: { value: unpaid.reduce((s, i) => s + Number(i.totalAmount), 0), invoiceCount: unpaid.length },
      nextDueDate: unpaid.map((i) => i.dueDate).sort()[0] ?? null,
      paidLast90Days: { value: 0, count: 0 },
    },
    classes: {
      upcoming: bookings
        .filter((b) => b.status === 'BOOKED' && keyOf(b.session.sessionDate) >= today)
        .sort((a, b) => `${a.session.sessionDate}${a.session.startTime}`.localeCompare(`${b.session.sessionDate}${b.session.startTime}`))
        .slice(0, 3)
        .map((b) => ({ sessionId: b.session.id, name: b.session.groupClass.name, date: keyOf(b.session.sessionDate), startTime: b.session.startTime, endTime: b.session.endTime, trainerName: null, bookingStatus: b.status })),
    },
    notifications: { unread: 0 },
  };
}

/**
 * Dashboard view-model: the real `/portal/overview` when it answers, else a
 * client-side fallback built from the per-resource hooks (never blank).
 * Also returns the raw records the detail modal needs.
 */
export function useDashboardData() {
  const overviewQ = useMemberOverview();
  const profileQ = useMemberProfile();
  const attendanceQ = useMemberAttendance(1, 90);
  const workoutQ = useMemberWorkout();
  const dietQ = useMemberDiet();
  const invoicesQ = useMemberInvoices(1, 20);
  const bookingsQ = useMemberBookings();

  const profile = profileQ.data;
  const fallback = React.useMemo(
    () =>
      profile && overviewQ.isError
        ? buildFallbackOverview({ profile, attendance: attendanceQ.data, workout: workoutQ.data, diet: dietQ.data, invoices: invoicesQ.data?.items ?? [], bookings: bookingsQ.data ?? [] })
        : null,
    [profile, overviewQ.isError, attendanceQ.data, workoutQ.data, dietQ.data, invoicesQ.data, bookingsQ.data],
  );
  const overview = overviewQ.data ?? fallback;
  return {
    overview,
    profile,
    usingFallback: !overviewQ.data && Boolean(fallback),
    loading: profileQ.isLoading || (overviewQ.isLoading && !overviewQ.isError),
    attendanceItems: attendanceQ.data?.items ?? [],
    workout: workoutQ.data ?? null,
    invoices: invoicesQ.data?.items ?? [],
    invoicesLoading: invoicesQ.isLoading,
  };
}
