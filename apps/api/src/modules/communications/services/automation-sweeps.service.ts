import type { AutomationRuleKey } from '@prisma/client';

import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { formatMoney } from '../../../infrastructure/mail/templates/base-layout';
import { paymentDueReminderEmail, paymentOverdueReminderEmail } from '../../../infrastructure/mail/templates/member-templates';
import { AUTOMATION_RULES } from '../constants/automation-rules';
import {
  AFTER_LOOKBACK_DAYS,
  HOUR_MS,
  addDays,
  daysBetween,
  matchesBirthday,
  pickAfterOffset,
  pickBeforeOffset,
  pickHoursBeforeOffset,
  utcDayStart,
} from '../utils/automation-timing.util';
import { formatDay, formatRupees } from '../utils/message-vars.util';
import { wallTimeToUtc } from '../utils/zoned-time.util';

import { EngineCache } from './automation-engine.service';

/*
 * Cross-tenant scheduler sweeps behind the automation rules. Like every other handler in `modules/scheduler/handlers`
 * these scan with the raw `prisma` client (a platform-level job; dev superuser bypasses RLS - see BACKEND-GUIDE) and then
 * act per tenant through `AutomationEngine`, which reads the tenant's rule (enabled / timings / channels / text) and
 * enforces the dedupe ledger, opt-out rules, the channel gate and the delivery log.
 */

export interface SweepResult extends Record<string, unknown> {
  scanned: number;
  sent: number;
  deduped: number;
}

const newResult = (): SweepResult => ({ scanned: 0, sent: 0, deduped: 0 });

/** Largest timing any tenant has configured for a rule (or the default) - bounds the DB scan window. */
async function globalMaxOffset(key: AutomationRuleKey): Promise<number> {
  const def = AUTOMATION_RULES[key];
  const rows = await prisma.notificationAutomationRule.findMany({ where: { key, enabled: true }, select: { offsets: true } });
  let max = Math.max(0, ...def.defaultOffsets);
  for (const r of rows) {
    if (Array.isArray(r.offsets)) for (const n of r.offsets) if (typeof n === 'number' && n > max) max = n;
  }
  return max;
}

function tally(result: SweepResult, outcome: 'SENT' | 'DEDUPED' | 'SKIPPED'): void {
  if (outcome === 'SENT') result.sent += 1;
  else if (outcome === 'DEDUPED') result.deduped += 1;
}

/** Open-invoice balance = total minus settled payments (SUCCESS + PARTIALLY_REFUNDED), never negative. */
function balanceOf(invoice: { totalAmount: unknown; payments: Array<{ finalAmount: unknown }> }): number {
  const settled = invoice.payments.reduce((s, p) => s + Number(p.finalAmount), 0);
  return Math.max(Number(invoice.totalAmount) - settled, 0);
}

const dayString = (d: Date): string => d.toISOString().slice(0, 10);

// ── MEMBERSHIP_EXPIRING ─────────────────────────────────────────────────────

export async function sweepMembershipExpiring(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', endDate: { gte: today, lte: addDays(today, await globalMaxOffset('MEMBERSHIP_EXPIRING')) } },
    select: { id: true, tenantId: true, memberId: true, endDate: true, plan: { select: { name: true } } },
  });
  for (const m of memberships) {
    result.scanned += 1;
    const engine = engines.for(m.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential across a daily batch; the per-tenant rule is cached after the first read
    const rule = await engine.rule('MEMBERSHIP_EXPIRING');
    if (!rule.enabled) continue;
    const daysLeft = daysBetween(today, m.endDate);
    const offset = pickBeforeOffset(daysLeft, rule.offsets);
    if (offset === null) continue;
    const first = offset === Math.max(...rule.offsets);
    // The pre-Communications job reminded once per membership (Redis key) - do not repeat that first message after the upgrade.
    // eslint-disable-next-line no-await-in-loop
    if (first && (await cache.get(`notif:membership-expiring:${m.id}`))) {
      // eslint-disable-next-line no-await-in-loop
      await engine.markHandled(rule, m.memberId, m.id, String(offset));
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({
      rule,
      memberId: m.memberId,
      subjectId: m.id,
      offsetKey: String(offset),
      vars: { planName: m.plan.name, endDate: formatDay(m.endDate), daysLeft: String(daysLeft), expiryStatus: `expires in ${daysLeft} day(s)` },
      staffFeed: first,
    }));
  }
  return result;
}

// ── MEMBERSHIP_EXPIRED ──────────────────────────────────────────────────────

export async function sweepMembershipExpired(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const window = (await globalMaxOffset('MEMBERSHIP_EXPIRED')) + AFTER_LOOKBACK_DAYS;
  const memberships = await prisma.membership.findMany({
    where: { status: 'EXPIRED', endDate: { gte: addDays(today, -window), lt: today } },
    select: { id: true, tenantId: true, memberId: true, endDate: true, plan: { select: { name: true } } },
  });
  for (const m of memberships) {
    result.scanned += 1;
    const engine = engines.for(m.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential daily batch
    const rule = await engine.rule('MEMBERSHIP_EXPIRED');
    if (!rule.enabled) continue;
    const daysSince = daysBetween(m.endDate, today);
    const offset = pickAfterOffset(daysSince, rule.offsets);
    if (offset === null) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await cache.get(`notif:membership-expired:${m.id}`)) {
      // eslint-disable-next-line no-await-in-loop
      await engine.markHandled(rule, m.memberId, m.id, String(offset));
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({
      rule,
      memberId: m.memberId,
      subjectId: m.id,
      offsetKey: String(offset),
      vars: { planName: m.plan.name, endDate: formatDay(m.endDate), expiryStatus: 'has expired' },
      staffFeed: offset === Math.min(...rule.offsets),
    }));
  }
  return result;
}

// ── INVOICE_DUE_SOON ────────────────────────────────────────────────────────

export async function sweepInvoiceDueSoon(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const invoices = await prisma.memberInvoice.findMany({
    where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { gte: today, lte: addDays(today, await globalMaxOffset('INVOICE_DUE_SOON')) } },
    select: {
      id: true,
      tenantId: true,
      memberId: true,
      invoiceNumber: true,
      dueDate: true,
      totalAmount: true,
      member: { select: { firstName: true } },
      items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { description: true } },
      payments: { where: { status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } }, select: { finalAmount: true } },
    },
  });
  for (const inv of invoices) {
    result.scanned += 1;
    const engine = engines.for(inv.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential daily batch
    const rule = await engine.rule('INVOICE_DUE_SOON');
    if (!rule.enabled) continue;
    const daysLeft = daysBetween(today, inv.dueDate);
    const offset = pickBeforeOffset(daysLeft, rule.offsets);
    if (offset === null) continue;
    const amount = balanceOf(inv);
    if (amount <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    if (offset === Math.max(...rule.offsets) && (await cache.get(`notif:payment-reminder:${inv.id}`))) {
      // eslint-disable-next-line no-await-in-loop
      await engine.markHandled(rule, inv.memberId, inv.id, String(offset));
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({
      rule,
      memberId: inv.memberId,
      subjectId: inv.id,
      offsetKey: String(offset),
      vars: { invoiceNumber: inv.invoiceNumber, dueDate: formatDay(inv.dueDate), amountDue: formatRupees(amount), daysLeft: String(daysLeft) },
      richEmail: (branding) => paymentDueReminderEmail(branding, inv.member.firstName, inv.invoiceNumber, formatMoney(amount, '₹'), dayString(inv.dueDate), inv.items[0]?.description ?? null),
    }));
  }
  return result;
}

// ── PAYMENT_OVERDUE ─────────────────────────────────────────────────────────

export async function sweepPaymentOverdue(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const window = (await globalMaxOffset('PAYMENT_OVERDUE')) + AFTER_LOOKBACK_DAYS;
  const invoices = await prisma.memberInvoice.findMany({
    where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { gte: addDays(today, -window), lt: today } },
    select: {
      id: true,
      tenantId: true,
      memberId: true,
      invoiceNumber: true,
      dueDate: true,
      totalAmount: true,
      member: { select: { firstName: true } },
      items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { description: true } },
      payments: { where: { status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } }, select: { finalAmount: true } },
    },
  });
  for (const inv of invoices) {
    result.scanned += 1;
    const engine = engines.for(inv.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential daily batch
    const rule = await engine.rule('PAYMENT_OVERDUE');
    if (!rule.enabled) continue;
    const daysSince = daysBetween(inv.dueDate, today);
    const offset = pickAfterOffset(daysSince, rule.offsets);
    if (offset === null) continue;
    const amount = balanceOf(inv);
    if (amount <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({
      rule,
      memberId: inv.memberId,
      subjectId: inv.id,
      offsetKey: String(offset),
      vars: { invoiceNumber: inv.invoiceNumber, dueDate: formatDay(inv.dueDate), amountDue: formatRupees(amount) },
      richEmail: (branding) => paymentOverdueReminderEmail(branding, inv.member.firstName, inv.invoiceNumber, formatMoney(amount, '₹'), dayString(inv.dueDate), inv.items[0]?.description ?? null),
    }));
  }
  return result;
}

// ── PAYMENT_FAILED ──────────────────────────────────────────────────────────

const FAILED_PAYMENT_WINDOW_DAYS = 14;

export async function sweepPaymentFailed(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const payments = await prisma.memberPayment.findMany({
    where: { status: 'FAILED', createdAt: { gte: addDays(today, -FAILED_PAYMENT_WINDOW_DAYS) } },
    select: { id: true, tenantId: true, memberId: true, finalAmount: true, createdAt: true },
  });
  for (const p of payments) {
    result.scanned += 1;
    const engine = engines.for(p.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential daily batch
    const rule = await engine.rule('PAYMENT_FAILED');
    if (!rule.enabled) continue;
    const daysSince = daysBetween(p.createdAt, today);
    const offset = pickAfterOffset(daysSince, rule.offsets, Math.max(0, FAILED_PAYMENT_WINDOW_DAYS - Math.max(...rule.offsets)));
    if (offset === null) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await cache.get(`notif:failed-payment-retry:${p.id}`)) {
      // eslint-disable-next-line no-await-in-loop
      await engine.markHandled(rule, p.memberId, p.id, String(offset));
      continue;
    }
    const amount = formatRupees(Number(p.finalAmount));
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({ rule, memberId: p.memberId, subjectId: p.id, offsetKey: String(offset), vars: { amountDue: amount, amount }, staffFeed: true }));
  }
  return result;
}

// ── BIRTHDAY ────────────────────────────────────────────────────────────────

export async function sweepBirthdays(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const today = utcDayStart(new Date());
  const members = await prisma.member.findMany({
    where: { dateOfBirth: { not: null }, deletedAt: null, status: { not: 'INACTIVE' } },
    select: { id: true, tenantId: true, dateOfBirth: true },
  });
  for (const m of members) {
    if (!m.dateOfBirth || !matchesBirthday(m.dateOfBirth, today)) continue;
    result.scanned += 1;
    const engine = engines.for(m.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential daily batch
    const rule = await engine.rule('BIRTHDAY');
    if (!rule.enabled) continue;
    const year = today.getUTCFullYear();
    // eslint-disable-next-line no-await-in-loop
    if (await cache.get(`notif:birthday:${m.id}:${year}`)) {
      // eslint-disable-next-line no-await-in-loop
      await engine.markHandled(rule, m.id, m.id, `y${year}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    tally(result, await engine.dispatch({ rule, memberId: m.id, subjectId: m.id, offsetKey: `y${year}`, staffFeed: true }));
  }
  return result;
}

// ── CLASS_REMINDER ──────────────────────────────────────────────────────────

/** "6:30 pm" from a 24h "HH:mm". */
export function formatClassTime(hhmm: string): string {
  const [h = '0', m = '00'] = hhmm.split(':');
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour >= 12 ? 'pm' : 'am'}`;
}

/** UTC instant a class session starts (its date + HH:mm interpreted in the branch's own timezone). */
export function sessionStart(sessionDate: Date, startTime: string, timezone: string): Date {
  const [h = '0', m = '0'] = startTime.split(':');
  return wallTimeToUtc(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth() + 1, sessionDate.getUTCDate(), Number(h), Number(m), timezone || 'UTC');
}

export async function sweepClassReminders(): Promise<SweepResult> {
  const result = newResult();
  const engines = new EngineCache();
  const now = new Date();
  const today = utcDayStart(now);
  const maxHours = await globalMaxOffset('CLASS_REMINDER');
  const sessions = await prisma.classSession.findMany({
    where: {
      status: 'SCHEDULED',
      sessionDate: { gte: addDays(today, -1), lte: addDays(today, Math.ceil(maxHours / 24) + 1) },
      bookings: { some: { status: 'BOOKED' } },
    },
    select: {
      id: true,
      tenantId: true,
      sessionDate: true,
      startTime: true,
      groupClass: { select: { name: true } },
      branch: { select: { timezone: true } },
      bookings: { where: { status: 'BOOKED' }, select: { memberId: true } },
    },
  });
  for (const s of sessions) {
    const hoursUntil = (sessionStart(s.sessionDate, s.startTime, s.branch.timezone).getTime() - now.getTime()) / HOUR_MS;
    const engine = engines.for(s.tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential 15-minute batch
    const rule = await engine.rule('CLASS_REMINDER');
    if (!rule.enabled) continue;
    const offset = pickHoursBeforeOffset(hoursUntil, rule.offsets);
    if (offset === null) continue;
    for (const booking of s.bookings) {
      result.scanned += 1;
      // eslint-disable-next-line no-await-in-loop
      tally(result, await engine.dispatch({
        rule,
        memberId: booking.memberId,
        subjectId: s.id,
        offsetKey: `${offset}h`,
        vars: { className: s.groupClass.name, classDate: formatDay(s.sessionDate), classTime: formatClassTime(s.startTime) },
        pushData: { type: 'class_reminder', classSessionId: s.id },
      }));
    }
  }
  return result;
}

// ── WE_MISS_YOU ─────────────────────────────────────────────────────────────

const WE_MISS_YOU_BATCH_PER_TENANT = 500;

export async function sweepWeMissYou(): Promise<SweepResult> {
  const result = newResult();
  const today = utcDayStart(new Date());
  // Off by default: only gyms that saved the rule as enabled are scanned.
  const rules = await prisma.notificationAutomationRule.findMany({ where: { key: 'WE_MISS_YOU', enabled: true }, select: { tenantId: true } });
  const engines = new EngineCache();
  for (const { tenantId } of rules) {
    const engine = engines.for(tenantId);
    // eslint-disable-next-line no-await-in-loop -- sequential per opted-in gym
    const rule = await engine.rule('WE_MISS_YOU');
    if (!rule.enabled) continue;
    const days = rule.offsets[0] ?? AUTOMATION_RULES.WE_MISS_YOU.defaultOffsets[0]!;
    const cutoff = addDays(today, -days);
    // eslint-disable-next-line no-await-in-loop
    const members = await prisma.member.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        joiningDate: { lte: cutoff },
        memberships: { some: { status: 'ACTIVE', endDate: { gte: today } } },
        attendances: { none: { deletedAt: null, attendanceDate: { gte: cutoff } } },
      },
      select: { id: true, attendances: { where: { deletedAt: null }, orderBy: { attendanceDate: 'desc' }, take: 1, select: { attendanceDate: true } } },
      take: WE_MISS_YOU_BATCH_PER_TENANT,
    });
    for (const m of members) {
      result.scanned += 1;
      const last = m.attendances[0]?.attendanceDate;
      const away = last ? daysBetween(last, today) : days;
      // One nudge per absence: the key changes only after the member visits again.
      // eslint-disable-next-line no-await-in-loop
      tally(result, await engine.dispatch({
        rule,
        memberId: m.id,
        subjectId: m.id,
        offsetKey: `${days}-${last ? dayString(last) : 'never'}`,
        vars: { daysAway: String(away) },
      }));
    }
  }
  return result;
}
