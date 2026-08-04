import { Router } from 'express';

import { NotFoundError } from '../../core/errors/app-error';
import { sendSuccess } from '../../core/http/response';
import { adminAiAssistantRouter } from '../../modules/admin-ai-assistant/routes/admin-ai-assistant.routes';
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
import { adminTenantBillingRouter } from '../../modules/admin-tenants/routes/admin-tenant-billing.routes';
import { adminTenantRouter } from '../../modules/admin-tenants/routes/admin-tenant.routes';
import { aiAssistantRouter } from '../../modules/ai-assistant/routes/ai-assistant.routes';
import { announcementRouter } from '../../modules/announcements/routes/announcement.routes';
import { attendanceRouter } from '../../modules/attendance/routes/attendance.routes';
import { auditLogRouter } from '../../modules/audit-logs/routes/audit-log.routes';
import { authRouter } from '../../modules/authentication/routes/auth.routes';
import { billingRouter } from '../../modules/billing/routes/billing.routes';
import { branchRouter } from '../../modules/branches/routes/branch.routes';
import { contactRouter } from '../../modules/contact/routes/contact.routes';
import { couponRouter } from '../../modules/coupon/routes/coupon.routes';
import { dietPlanRouter } from '../../modules/diet/routes/diet-plan.routes';
import { foodRouter } from '../../modules/diet/routes/food.routes';
import { expenseRouter } from '../../modules/finance/routes/expense.routes';
import { financeDashboardRouter } from '../../modules/finance/routes/finance-dashboard.routes';
import { incomeRouter } from '../../modules/finance/routes/income.routes';
import { memberInvoiceRouter } from '../../modules/finance/routes/member-invoice.routes';
import { memberPaymentRouter } from '../../modules/finance/routes/member-payment.routes';
import { invitationRouter } from '../../modules/invitations/routes/invitation.routes';
import { invoiceRouter } from '../../modules/invoice/routes/invoice.routes';
import { memberRouter } from '../../modules/members/routes/member.routes';
import { membershipPlanRouter } from '../../modules/members/routes/membership-plan.routes';
import { onboardingRouter } from '../../modules/onboarding/routes/onboarding.routes';
import { paymentRouter } from '../../modules/payment/routes/payment.routes';
import { permissionRouter } from '../../modules/permissions/routes/permission.routes';
import { profileRouter } from '../../modules/profile/routes/profile.routes';
import { analyticsRouter } from '../../modules/reports/routes/analytics.routes';
import { dashboardRouter } from '../../modules/reports/routes/dashboard.routes';
import { reportsRouter } from '../../modules/reports/routes/reports.routes';
import { scheduledReportRouter } from '../../modules/reports/routes/scheduled-report.routes';
import { roleRouter } from '../../modules/roles/routes/role.routes';
import { rumRouter } from '../../modules/rum/routes/rum.routes';
import { adminSchedulerRouter } from '../../modules/scheduler/routes/admin-scheduler.routes';
import { sessionRouter } from '../../modules/sessions/routes/session.routes';
import { settingsRouter } from '../../modules/settings/routes/settings.routes';
import { staffRouter } from '../../modules/staff/routes/staff.routes';
import { subscriptionRouter } from '../../modules/subscription/routes/subscription.routes';
import { ticketRouter } from '../../modules/support/routes/ticket.routes';
import { tenantAnnouncementRouter } from '../../modules/tenant-announcements/routes/tenant-announcement.routes';
import { notificationTemplateRouter } from '../../modules/tenant-notifications/routes/notification-template.routes';
import { tenantNotificationRouter } from '../../modules/tenant-notifications/routes/tenant-notification.routes';
import { tenantService } from '../../modules/tenants/service/tenant.service';
import { userRouter } from '../../modules/users/routes/user.routes';
import { webhookRouter } from '../../modules/webhook/routes/webhook.routes';
import { exerciseRouter } from '../../modules/workouts/routes/exercise.routes';
import { workoutPlanRouter } from '../../modules/workouts/routes/workout-plan.routes';

export const v1Router: Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/admin/auth', adminAuthRouter);
v1Router.use('/admin/ai', adminAiAssistantRouter);
v1Router.use('/admin/dashboard', adminDashboardRouter);
v1Router.use('/admin/tenants', adminTenantRouter);
v1Router.use('/admin/tenants', adminTenantBillingRouter);
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
v1Router.use('/admin/scheduler', adminSchedulerRouter);
v1Router.use('/onboarding', onboardingRouter);
v1Router.use('/subscription', subscriptionRouter);
v1Router.use('/billing', billingRouter);
v1Router.use('/payment', paymentRouter);
v1Router.use('/coupon', couponRouter);
v1Router.use('/invoice', invoiceRouter);
v1Router.use('/webhook', webhookRouter);
v1Router.use('/branches', branchRouter);
// Notifications & Communication (Prompt 21) — /notifications/templates must
// be mounted before the general /notifications router so it isn't shadowed
// by that router's own `/:notificationId` param routes (same reasoning as
// Reports & Analytics below). `/tenant-announcements` is this tenant's own
// in-gym announcement authoring — distinct from `/announcements` (the
// pre-existing platform-plane consumption-only endpoint), see
// BACKEND-GUIDE.md §Notifications & Communication for the naming rationale.
v1Router.use('/notifications/templates', notificationTemplateRouter);
v1Router.use('/notifications', tenantNotificationRouter);
v1Router.use('/announcements', announcementRouter);
v1Router.use('/tenant-announcements', tenantAnnouncementRouter);
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
v1Router.use('/support/tickets', ticketRouter);
v1Router.use('/members', memberRouter);
v1Router.use('/membership-plans', membershipPlanRouter);
v1Router.use('/attendance', attendanceRouter);
v1Router.use('/exercises', exerciseRouter);
v1Router.use('/workout-plans', workoutPlanRouter);
v1Router.use('/foods', foodRouter);
v1Router.use('/diet-plans', dietPlanRouter);
v1Router.use('/ai', aiAssistantRouter);
v1Router.use('/payments', memberPaymentRouter);
v1Router.use('/invoices', memberInvoiceRouter);
v1Router.use('/income', incomeRouter);
v1Router.use('/expenses', expenseRouter);
v1Router.use('/finance', financeDashboardRouter);
// Reports & Analytics (Prompt 20) — /reports/dashboard and /reports/scheduled
// must be mounted before the general /reports router so their sub-paths
// aren't shadowed by it (see modules/reports/routes/reports.routes.ts).
v1Router.use('/reports/dashboard', dashboardRouter);
v1Router.use('/reports/scheduled', scheduledReportRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/analytics', analyticsRouter);
// Platform-plane (no tenant check — mounted under /public, see PLATFORM_ROUTE_PREFIXES).
v1Router.use('/public/contact', contactRouter);
v1Router.use('/public/rum', rumRouter);

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
