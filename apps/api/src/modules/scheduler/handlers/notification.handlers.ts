import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { dispatchNotification } from '../../admin-notifications/services/admin-notification.service';
import { decryptMemberContactMany } from '../../members/utils/member-pii.util';
import { TenantAnnouncementRepository } from '../../tenant-announcements/repositories/tenant-announcement.repository';
import {
  notifyAnnouncementPublished,
  notifyBirthdayWishes,
  notifyNewMemberRegistration,
  welcomeSentCacheKey,
} from '../../tenant-notifications/services/notification-trigger.service';
import type { JobHandler } from '../types';

/**
 * Closes a previously-documented gap: `Notification.scheduledAt` was
 * persisted at creation but never acted on — sending it required a manual
 * "Send" click regardless of the chosen schedule. This sweep dispatches any
 * due, not-yet-sent notification through the exact same `dispatchNotification`
 * path the manual button uses.
 */
export const sendScheduledNotifications: JobHandler = async () => {
  const due = await prisma.notification.findMany({
    where: { sentAt: null, scheduledAt: { not: null, lte: new Date() } },
  });

  let sent = 0;
  for (const notification of due) {
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (15-min) batch; no throughput requirement justifies parallelizing
    await dispatchNotification(notification);
    // eslint-disable-next-line no-await-in-loop
    await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
    sent += 1;
  }
  return { scanned: due.length, sent };
};

/** Migrated from the old `tenant-announcement-scheduler.jobs.ts` module-local BullMQ registration — same publish/expire logic, now triggered by this module's registry instead of its own `repeat`. */
export const sendScheduledAnnouncements: JobHandler = async () => {
  const due = await TenantAnnouncementRepository.findDuePublications(prisma, new Date());
  for (const announcement of due) {
    const now = new Date();
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (hourly) batch; no throughput requirement justifies parallelizing
    await prisma.tenantAnnouncement.update({ where: { id: announcement.id }, data: { status: 'PUBLISHED', publishAt: null, publishedAt: now } });
    // eslint-disable-next-line no-await-in-loop
    await notifyAnnouncementPublished(announcement.tenantId, { title: announcement.title, body: stripHtml(announcement.body) });
  }

  const expiring = await TenantAnnouncementRepository.findDueExpirations(prisma, new Date());
  for (const announcement of expiring) {
    // eslint-disable-next-line no-await-in-loop -- see above
    await prisma.tenantAnnouncement.update({ where: { id: announcement.id }, data: { status: 'EXPIRED' } });
  }

  return { published: due.length, expired: expiring.length };
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Members whose birthday (month + day) is today — no prior sweep existed for this; the `BIRTHDAY_WISHES` template existed but had no firing point. */
export const birthdayWishes: JobHandler = async () => {
  const now = new Date();
  const members = decryptMemberContactMany(
    await prisma.member.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true },
    }),
  );

  const todaysBirthdays = members.filter(
    (m) => m.dateOfBirth!.getUTCMonth() === now.getUTCMonth() && m.dateOfBirth!.getUTCDate() === now.getUTCDate(),
  );

  let wished = 0;
  for (const member of todaysBirthdays) {
    const dedupeKey = `notif:birthday:${member.id}:${now.getUTCFullYear()}`;
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifyBirthdayWishes(member.tenantId, { memberName: `${member.firstName} ${member.lastName}`.trim(), memberEmail: member.email });
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, 400 * 86_400); // outlives a year so it never double-fires within the same birthday
    wished += 1;
  }
  return { scanned: todaysBirthdays.length, wished };
};

const WELCOME_CATCHUP_WINDOW_HOURS = 48;

/**
 * Welcome messages fire synchronously at registration (`member.service.ts` →
 * `notifyNewMemberRegistration`) — NOT a normally schedulable job. This is a
 * safety-net catch-up sweep only: it re-sends to members registered recently
 * whose `welcome-sent:{memberId}` marker was never set (e.g. the synchronous
 * send failed, or email was added after registration), and is a no-op for
 * everyone already welcomed.
 */
export const welcomeMessages: JobHandler = async () => {
  const windowStart = new Date(Date.now() - WELCOME_CATCHUP_WINDOW_HOURS * 60 * 60_000);
  const recentMembers = decryptMemberContactMany(
    await prisma.member.findMany({
      where: { createdAt: { gte: windowStart }, email: { not: null } },
      select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, phone: true, memberId: true },
    }),
  );

  let caughtUp = 0;
  for (const member of recentMembers) {
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (30-min) batch; no throughput requirement justifies parallelizing
    if (await cache.get(welcomeSentCacheKey(member.id))) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifyNewMemberRegistration(member.tenantId, {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      memberCode: member.memberId,
      memberEmail: member.email,
    });
    caughtUp += 1;
  }
  return { scanned: recentMembers.length, caughtUp };
};
