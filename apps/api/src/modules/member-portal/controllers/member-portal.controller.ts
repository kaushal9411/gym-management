import type { DeviceTokenPlatform, TenantNotificationCategory } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { buildMemberAuthService } from '../../member-auth/services/member-auth.service';
import { MemberGdprService } from '../../members/services/member-gdpr.service';
import { MemberOverviewService } from '../services/member-overview.service';
import { MemberPortalService } from '../services/member-portal.service';
import { MemberProfileService } from '../services/member-profile.service';

function serviceFor(req: Request): MemberPortalService {
  return new MemberPortalService(req.tenant!.id);
}

function memberId(req: Request): string {
  return req.memberAuth!.sub;
}

function overviewFor(req: Request): MemberOverviewService {
  return new MemberOverviewService(req.tenant!.id);
}

function profileFor(req: Request): MemberProfileService {
  return new MemberProfileService(req.tenant!.id);
}

function ctxOf(req: Request) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

export class MemberPortalController {
  async getProfile(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await profileFor(req).get(memberId(req)));
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await profileFor(req).update(memberId(req), req.body, ctxOf(req)), 'Profile updated.');
  }

  async uploadProfilePhoto(req: Request, res: Response): Promise<void> {
    const { image } = req.body as { image: string };
    sendSuccess(res, await profileFor(req).uploadPhoto(memberId(req), image, ctxOf(req)), 'Photo updated.');
  }

  async removeProfilePhoto(req: Request, res: Response): Promise<void> {
    await profileFor(req).removePhoto(memberId(req), ctxOf(req));
    sendSuccess(res, null, 'Photo removed.');
  }

  async overview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await overviewFor(req).getOverview(memberId(req)));
  }

  async payments(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await overviewFor(req).listPayments(memberId(req), page, limit));
  }

  async invoiceDetail(req: Request<{ id: string }>, res: Response): Promise<void> {
    sendSuccess(res, await overviewFor(req).getInvoiceDetail(memberId(req), req.params.id));
  }

  async gym(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await overviewFor(req).getGym(memberId(req)));
  }

  async me(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getProfile(memberId(req)));
  }

  async attendance(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).getAttendance(memberId(req), { page, limit }));
  }

  async workout(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getWorkout(memberId(req)));
  }

  async markWorkoutProgress(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).markWorkoutProgress(memberId(req), req.params.id, req.body);
    sendSuccess(res, result, 'Progress updated.');
  }

  async registerDeviceToken(req: Request, res: Response): Promise<void> {
    const { token, platform } = req.body as { token: string; platform: DeviceTokenPlatform };
    await serviceFor(req).registerDeviceToken(memberId(req), token, platform);
    sendSuccess(res, null, 'Device registered for push notifications.');
  }

  async unregisterDeviceToken(req: Request, res: Response): Promise<void> {
    const { token } = req.body as { token: string };
    await serviceFor(req).unregisterDeviceToken(token);
    sendSuccess(res, null, 'Device unregistered.');
  }

  async notifications(req: Request, res: Response): Promise<void> {
    const { unreadOnly, category, page, limit } = req.query as unknown as {
      unreadOnly?: boolean;
      category?: TenantNotificationCategory;
      page: number;
      limit: number;
    };
    sendSuccess(res, await serviceFor(req).getNotifications(memberId(req), { unreadOnly, category, page, limit }));
  }

  async unreadNotificationCount(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getUnreadNotificationCount(memberId(req)));
  }

  async markNotificationRead(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).markNotificationRead(memberId(req), req.params.id);
    sendSuccess(res, null, 'Marked as read.');
  }

  async markAllNotificationsRead(req: Request, res: Response): Promise<void> {
    await serviceFor(req).markAllNotificationsRead(memberId(req));
    sendSuccess(res, null, 'All notifications marked as read.');
  }

  async diet(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getDiet(memberId(req)));
  }

  async measurements(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getMeasurements(memberId(req)));
  }

  async logDiet(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).logDiet(memberId(req), req.params.id, req.body);
    sendSuccess(res, result, 'Diet log updated.');
  }

  async invoices(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).getInvoices(memberId(req), { page, limit }));
  }

  async downloadInvoice(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { filename, content } = await serviceFor(req).downloadInvoicePdf(memberId(req), req.params.id);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(content);
  }

  async classes(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query as { dateFrom: string; dateTo: string };
    sendSuccess(res, await serviceFor(req).getUpcomingClasses(memberId(req), dateFrom, dateTo));
  }

  async bookClass(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).bookClass(memberId(req), req.params.id);
    sendSuccess(res, result, 'Booked.', 201);
  }

  async cancelBooking(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).cancelBooking(memberId(req), req.params.id);
    sendSuccess(res, null, 'Booking cancelled.');
  }

  async myBookings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getMyBookings(memberId(req)));
  }

  /** Self-service GDPR data-portability export — same underlying bundle the staff-side `GET /members/:id/gdpr-export` returns, just scoped to the caller's own id. */
  async gdprExport(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new MemberGdprService(req.tenant!.id).exportData(memberId(req)));
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await buildMemberAuthService(req.tenant!.id).changePassword(memberId(req), currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed. Please sign in again on your other devices.');
  }

  async startRenewalCheckout(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).startRenewalCheckout(memberId(req)), 'Checkout started.', 201);
  }

  async verifyRenewalCheckout(req: Request<{ paymentId: string }>, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).verifyRenewalCheckout(memberId(req), req.params.paymentId, req.body));
  }

  async startInvoicePaymentCheckout(req: Request<{ id: string }>, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).startInvoicePaymentCheckout(memberId(req), req.params.id), 'Checkout started.', 201);
  }

  async verifyInvoicePaymentCheckout(req: Request<{ id: string; paymentId: string }>, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).verifyInvoicePaymentCheckout(memberId(req), req.params.id, req.params.paymentId, req.body));
  }
}

export const memberPortalController = new MemberPortalController();
