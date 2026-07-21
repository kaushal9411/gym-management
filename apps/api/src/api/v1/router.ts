import { Router } from 'express';

import { NotFoundError } from '../../core/errors/app-error';
import { sendSuccess } from '../../core/http/response';
import { adminAuditRouter } from '../../modules/admin-audit/routes/admin-audit.routes';
import { adminAuthRouter } from '../../modules/admin-auth/routes/admin-auth.routes';
import { adminCmsRouter } from '../../modules/admin-cms/routes/admin-cms.routes';
import { adminCouponRouter } from '../../modules/admin-coupons/routes/admin-coupon.routes';
import { adminDashboardRouter } from '../../modules/admin-dashboard/routes/admin-dashboard.routes';
import { adminFeatureFlagRouter } from '../../modules/admin-feature-flags/routes/admin-feature-flag.routes';
import { adminNotificationRouter } from '../../modules/admin-notifications/routes/admin-notification.routes';
import { adminPaymentRouter } from '../../modules/admin-payments/routes/admin-payment.routes';
import { adminPlanRouter } from '../../modules/admin-plans/routes/admin-plan.routes';
import { adminReferenceDataRouter } from '../../modules/admin-reference-data/routes/admin-reference-data.routes';
import { adminRevenueRouter } from '../../modules/admin-revenue/routes/admin-revenue.routes';
import { adminRoleRouter } from '../../modules/admin-roles/routes/admin-role.routes';
import { adminSettingsRouter } from '../../modules/admin-settings/routes/admin-settings.routes';
import { adminTicketRouter } from '../../modules/admin-support/routes/admin-ticket.routes';
import { adminTemplateRouter } from '../../modules/admin-templates/routes/admin-template.routes';
import { adminTenantRouter } from '../../modules/admin-tenants/routes/admin-tenant.routes';
import { announcementRouter } from '../../modules/announcements/routes/announcement.routes';
import { attendanceRouter } from '../../modules/attendance/routes/attendance.routes';
import { auditLogRouter } from '../../modules/audit-logs/routes/audit-log.routes';
import { authRouter } from '../../modules/authentication/routes/auth.routes';
import { billingRouter } from '../../modules/billing/routes/billing.routes';
import { branchRouter } from '../../modules/branches/routes/branch.routes';
import { contactRouter } from '../../modules/contact/routes/contact.routes';
import { couponRouter } from '../../modules/coupon/routes/coupon.routes';
import { invitationRouter } from '../../modules/invitations/routes/invitation.routes';
import { invoiceRouter } from '../../modules/invoice/routes/invoice.routes';
import { memberRouter } from '../../modules/members/routes/member.routes';
import { membershipPlanRouter } from '../../modules/members/routes/membership-plan.routes';
import { onboardingRouter } from '../../modules/onboarding/routes/onboarding.routes';
import { paymentRouter } from '../../modules/payment/routes/payment.routes';
import { permissionRouter } from '../../modules/permissions/routes/permission.routes';
import { profileRouter } from '../../modules/profile/routes/profile.routes';
import { roleRouter } from '../../modules/roles/routes/role.routes';
import { sessionRouter } from '../../modules/sessions/routes/session.routes';
import { settingsRouter } from '../../modules/settings/routes/settings.routes';
import { staffRouter } from '../../modules/staff/routes/staff.routes';
import { subscriptionRouter } from '../../modules/subscription/routes/subscription.routes';
import { tenantNotificationRouter } from '../../modules/tenant-notifications/routes/tenant-notification.routes';
import { tenantService } from '../../modules/tenants/service/tenant.service';
import { userRouter } from '../../modules/users/routes/user.routes';
import { webhookRouter } from '../../modules/webhook/routes/webhook.routes';

export const v1Router: Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/admin/auth', adminAuthRouter);
v1Router.use('/admin/dashboard', adminDashboardRouter);
v1Router.use('/admin/tenants', adminTenantRouter);
v1Router.use('/admin/plans', adminPlanRouter);
v1Router.use('/admin/coupons', adminCouponRouter);
v1Router.use('/admin/payments', adminPaymentRouter);
v1Router.use('/admin/revenue', adminRevenueRouter);
v1Router.use('/admin/support/tickets', adminTicketRouter);
v1Router.use('/admin/feature-flags', adminFeatureFlagRouter);
v1Router.use('/admin/cms', adminCmsRouter);
v1Router.use('/admin/notifications', adminNotificationRouter);
v1Router.use('/admin/settings', adminSettingsRouter);
v1Router.use('/admin/audit-logs', adminAuditRouter);
v1Router.use('/admin/roles', adminRoleRouter);
v1Router.use('/admin/reference-data', adminReferenceDataRouter);
v1Router.use('/admin/templates', adminTemplateRouter);
v1Router.use('/onboarding', onboardingRouter);
v1Router.use('/subscription', subscriptionRouter);
v1Router.use('/billing', billingRouter);
v1Router.use('/payment', paymentRouter);
v1Router.use('/coupon', couponRouter);
v1Router.use('/invoice', invoiceRouter);
v1Router.use('/webhook', webhookRouter);
v1Router.use('/branches', branchRouter);
v1Router.use('/notifications', tenantNotificationRouter);
v1Router.use('/announcements', announcementRouter);
// IAM (Prompt 11) — the authorization plane every future module builds on.
v1Router.use('/users', userRouter);
v1Router.use('/roles', roleRouter);
v1Router.use('/permissions', permissionRouter);
v1Router.use('/invitations', invitationRouter);
v1Router.use('/sessions', sessionRouter);
v1Router.use('/profile', profileRouter);
v1Router.use('/audit-logs', auditLogRouter);
v1Router.use('/settings', settingsRouter);
v1Router.use('/staff', staffRouter);
v1Router.use('/members', memberRouter);
v1Router.use('/membership-plans', membershipPlanRouter);
v1Router.use('/attendance', attendanceRouter);
// Platform-plane (no tenant check — mounted under /public, see PLATFORM_ROUTE_PREFIXES).
v1Router.use('/public/contact', contactRouter);

/**
 * @openapi
 * /public/tenants/resolve:
 *   get:
 *     tags: [Authentication]
 *     summary: Resolve a tenant's public branding by slug (no auth required)
 *     description: Used by tenant-web to paint the correct gym branding before the user has logged in.
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant branding }
 *       404: { description: No gym found for this slug }
 */
v1Router.get('/public/tenants/resolve', async (req, res, next) => {
  try {
    const slug = String(req.query.slug ?? '').toLowerCase();
    const resolved = slug ? await tenantService.resolveBySlug(slug) : null;
    if (!resolved) throw new NotFoundError('No gym found for this address');
    sendSuccess(res, resolved.tenant);
  } catch (error) {
    next(error);
  }
});
