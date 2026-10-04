import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { MemberDietPlanRepository } from '../../diet/repositories/member-diet-plan.repository';
import { MemberInvoiceService } from '../../finance/services/member-invoice.service';
import { remainingBalance, sumOfSettledPayments } from '../../finance/utils/invoice-pdf.helpers';
import { addDaysStr, money } from '../../finance/utils/payments-analytics.util';
import { computeFinalMembershipPrice } from '../../members/utils/plan-pricing.util';
import { tenantService } from '../../tenants/service/tenant.service';
import { MemberWorkoutPlanRepository } from '../../workouts/repositories/member-workout-plan.repository';
import type {
  MemberGymDto,
  MemberInvoiceDetailPortalDto,
  MemberOverviewDto,
  MemberPaymentItemDto,
} from '../dto/member-portal.dto';
import { MemberPortalRepository } from '../repositories/member-portal.repository';
import {
  computeStreaks,
  DAILY_WINDOW_DAYS,
  fillDailySeries,
  fillWeekdayCounts,
  flattenBusinessHours,
  membershipCountdown,
  monthComparisonWindows,
  pickSocialLinks,
  progressPercent,
  sumVisits,
  weekStartMonday,
} from '../utils/member-overview.util';

const m2 = (v: string | number): string => money(Number(v));
const nonEmpty = (v: string | null | undefined): string | null => (v && v.trim() ? v : null);
const allNull = (o: Record<string, unknown>): boolean => Object.values(o).every((v) => v === null);

/**
 * Member-plane read models for the redesigned portal. Every method receives the AUTHENTICATED member's id
 * (`req.memberAuth.sub`) and filters every query to it — same "the filter IS the authorization" rule as
 * `MemberPortalService`. A resource that exists but belongs to someone else is reported as missing (404).
 */
export class MemberOverviewService {
  private readonly repo: MemberPortalRepository;
  private readonly workouts: MemberWorkoutPlanRepository;
  private readonly diets: MemberDietPlanRepository;
  private readonly invoices: MemberInvoiceService;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repo = new MemberPortalRepository(db);
    this.workouts = new MemberWorkoutPlanRepository(db);
    this.diets = new MemberDietPlanRepository(db);
    this.invoices = new MemberInvoiceService(tenantId);
  }

  async getOverview(memberId: string, now: Date = new Date()): Promise<MemberOverviewDto> {
    const t = this.tenantId;
    const today = now.toISOString().slice(0, 10);
    const windowFrom = addDaysStr(today, -(DAILY_WINDOW_DAYS - 1));
    const paidSince = addDaysStr(today, -89);

    const [
      member,
      membership,
      visitRows,
      visitStats,
      workout,
      diet,
      outstanding,
      paid90,
      bookings,
      unread,
      bodyWeight,
    ] = await Promise.all([
      this.repo.findMember(t, memberId),
      this.repo.findCurrentMembership(t, memberId),
      this.repo.visitDays(t, memberId),
      this.repo.visitStats(t, memberId, windowFrom),
      this.workouts.findActiveByMember(t, memberId),
      this.diets.findActiveByMember(t, memberId),
      this.repo.outstandingInvoices(t, memberId),
      this.repo.paidSince(t, memberId, paidSince),
      this.repo.upcomingBookings(t, memberId, today, 3),
      this.repo.unreadNotifications(t, memberId),
      this.repo.latestBodyWeight(t, memberId),
    ]);
    if (!member) throw new NotFoundError('Member not found.');

    // Membership
    let membershipDto: MemberOverviewDto['membership'] = null;
    if (membership) {
      const endDate = membership.endDate.toISOString().slice(0, 10);
      const { daysLeft, expired } = membershipCountdown(endDate, today);
      const price = computeFinalMembershipPrice({
        price: membership.priceAtAssignment,
        discountPercentage: membership.plan.discountPercentage,
        taxPercentage: membership.plan.taxPercentage,
      });
      membershipDto = {
        planName: membership.plan.name,
        status: membership.status,
        startDate: membership.startDate.toISOString().slice(0, 10),
        endDate,
        daysLeft,
        expired,
        totalDays: membership.durationDays,
        price: money(price.finalPrice),
        amountPaid: money(await this.repo.membershipAmountPaid(t, memberId, membership.id)),
      };
    }

    // Attendance
    const { current, previous } = monthComparisonWindows(today);
    const streaks = computeStreaks(
      visitRows.map((r) => r.date),
      today,
    );
    const windowRows = visitRows.filter((r) => r.date >= windowFrom);

    // Workout
    let workoutDto: MemberOverviewDto['workout'] = null;
    if (workout) {
      const planExerciseIds = new Set(workout.workoutPlan.exercises.map((e) => e.exerciseId));
      const weekStart = new Date(`${weekStartMonday(today)}T00:00:00.000Z`);
      const done = workout.progress.filter(
        (p) => p.status === 'COMPLETED' && planExerciseIds.has(p.exerciseId),
      );
      workoutDto = {
        planName: workout.workoutPlan.name,
        progressPercent: progressPercent(done.length, planExerciseIds.size),
        completedExercises: done.length,
        totalExercises: planExerciseIds.size,
        completedThisWeek: done.filter((p) => p.markedAt && p.markedAt >= weekStart).length,
      };
    }

    // Diet — latest weight is the newer of the latest diet-log weight and the latest body measurement.
    let dietDto: MemberOverviewDto['diet'] = null;
    if (diet) {
      const todayLog = diet.dailyLogs.find((l) => l.date.toISOString().slice(0, 10) === today);
      const logWeight = diet.dailyLogs.find((l) => l.weightKg != null);
      const logWeightDate = logWeight?.date.toISOString().slice(0, 10) ?? '';
      const bodyDate = bodyWeight?.recordedAt.toISOString().slice(0, 10) ?? '';
      const latest =
        logWeight && logWeightDate >= bodyDate
          ? logWeight.weightKg
          : (bodyWeight?.weightKg ?? logWeight?.weightKg ?? null);
      dietDto = {
        planName: diet.dietPlan.name,
        dailyCalories: diet.dietPlan.dailyCalories ?? null,
        loggedToday: !!todayLog,
        waterTodayMl: todayLog?.waterIntakeMl ?? null,
        latestWeightKg: latest != null ? latest.toString() : null,
      };
    }

    return {
      member: {
        id: member.id,
        memberId: member.memberId,
        name: `${member.firstName} ${member.lastName}`.trim(),
        photoUrl: member.profilePhotoUrl,
        joiningDate: member.joiningDate.toISOString().slice(0, 10),
        branch: member.branch ? { id: member.branch.id, name: member.branch.name } : null,
        trainer: member.trainer ? { id: member.trainer.id, name: member.trainer.name } : null,
      },
      membership: membershipDto,
      attendance: {
        thisMonth: {
          visits: sumVisits(visitRows, current),
          previous: sumVisits(visitRows, previous),
        },
        currentStreakDays: streaks.current,
        bestStreakDays: streaks.best,
        totalVisits: visitRows.reduce((s, r) => s + r.visits, 0),
        avgVisitMinutes: visitStats.avgMinutes != null ? Math.round(visitStats.avgMinutes) : null,
        lastVisitAt: visitStats.lastVisitAt?.toISOString() ?? null,
        weekday: fillWeekdayCounts(windowRows, { from: windowFrom, to: today }),
        daily: fillDailySeries(windowRows, today),
      },
      workout: workoutDto,
      diet: dietDto,
      billing: {
        outstanding: { value: money(outstanding.value), invoiceCount: outstanding.count },
        nextDueDate: outstanding.nextDueDate,
        paidLast90Days: { value: money(paid90.value), count: paid90.count },
      },
      classes: {
        upcoming: bookings.map((b) => ({
          sessionId: b.classSession.id,
          name: b.classSession.groupClass.name,
          date: b.classSession.sessionDate.toISOString().slice(0, 10),
          startTime: b.classSession.startTime,
          endTime: b.classSession.endTime,
          trainerName: b.classSession.trainer?.name ?? null,
          bookingStatus: b.status,
        })),
      },
      notifications: { unread },
    };
  }

  async listPayments(memberId: string, page: number, limit: number) {
    const { items, total, refunded } = await this.repo.listPayments(
      this.tenantId,
      memberId,
      page,
      limit,
    );
    const dtoItems: MemberPaymentItemDto[] = items.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: money(Number(p.finalAmount)),
      method: p.method,
      status: p.status,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      invoiceId: p.invoice?.id ?? null,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
      totalRefunded: money(refunded.get(p.id) ?? 0),
    }));
    return {
      items: dtoItems,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** 404 unless the invoice belongs to `memberId` (ownership is in the repository WHERE). */
  async getInvoiceDetail(
    memberId: string,
    invoiceId: string,
  ): Promise<MemberInvoiceDetailPortalDto> {
    const inv = await this.invoices.getOwnById(invoiceId, memberId);
    const paid = sumOfSettledPayments(inv.payments);
    const balance =
      inv.status === 'PAID' || inv.status === 'CANCELLED'
        ? 0
        : remainingBalance(inv.totalAmount, paid);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      status: inv.status,
      subtotal: m2(inv.subtotal),
      taxAmount: m2(inv.taxAmount),
      discountAmount: m2(inv.discountAmount),
      totalAmount: m2(inv.totalAmount),
      items: inv.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: m2(i.unitPrice),
        amount: m2(i.amount),
      })),
      payments: inv.payments.map((p) => ({
        paymentNumber: p.paymentNumber,
        finalAmount: m2(p.finalAmount),
        status: p.status,
        paymentDate: p.paymentDate,
      })),
      paid: money(paid),
      balance: money(balance),
      branch: { name: inv.branch.name },
    };
  }

  /** Public-safe gym info only: no GST/registration number, no staff emails, no internal settings. */
  async getGym(memberId: string): Promise<MemberGymDto> {
    const member = await this.repo.findMember(this.tenantId, memberId);
    if (!member) throw new NotFoundError('Member not found.');
    const [tenant, profile, branch] = await Promise.all([
      tenantService.resolveById(this.tenantId),
      this.repo.findProfile(this.tenantId),
      this.repo.findBranch(this.tenantId, member.branch.id),
    ]);
    if (!tenant) throw new NotFoundError('Gym not found.');

    const address = profile
      ? {
          line1: nonEmpty(profile.addressLine),
          city: nonEmpty(profile.city),
          state: nonEmpty(profile.state),
          country: nonEmpty(profile.country),
          postalCode: nonEmpty(profile.postalCode),
        }
      : null;
    const branchAddress = branch
      ? {
          line1: nonEmpty(branch.addressLine1),
          line2: nonEmpty(branch.addressLine2),
          city: nonEmpty(branch.city),
          state: nonEmpty(branch.state),
          country: nonEmpty(branch.country),
          postalCode: nonEmpty(branch.postalCode),
        }
      : null;
    return {
      name: tenant.name,
      logoUrl: tenant.branding.logoUrl ?? null,
      address: address && !allNull(address) ? address : null,
      phone: nonEmpty(profile?.phone),
      email: nonEmpty(profile?.email),
      website: nonEmpty(profile?.website),
      businessHours: flattenBusinessHours(profile?.businessHours),
      social: pickSocialLinks(profile?.socialLinks),
      branch: branch
        ? {
            name: branch.name,
            phone: nonEmpty(branch.phone),
            email: nonEmpty(branch.email),
            address: branchAddress && !allNull(branchAddress) ? branchAddress : null,
            businessHours: flattenBusinessHours(branch.operatingHours),
          }
        : null,
    };
  }
}
