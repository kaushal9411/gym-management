import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { settingsController } from '../controllers/settings.controller';
import {
  updateBrandingSchema,
  updateBusinessHoursSchema,
  updateBusinessSettingsSchema,
  updateContactInfoSchema,
  updateEmailSettingsSchema,
  updateGymProfileSchema,
  updateInvoiceSettingsSchema,
  updateNotificationSettingsSchema,
  updateSocialLinksSchema,
  uploadBrandingAssetSchema,
  uploadImageSchema,
} from '../validators/settings.validators';

export const settingsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

settingsRouter.use(authenticateMiddleware);
const canRead = requirePermission('settings:read');
const canManage = requirePermission('settings:manage');

/**
 * @openapi
 * /settings/profile:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Gym Profile (name, legal/registration/tax info, description, contact, address, hours, social links)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Gym profile }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: Update Gym Profile (name, legal business name, registration number, GST/VAT number, business type, description)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Gym profile updated }
 */
settingsRouter.get('/profile', canRead, asyncHandler(settingsController.getProfile.bind(settingsController)));
settingsRouter.patch(
  '/profile',
  canManage,
  validate({ body: updateGymProfileSchema }),
  asyncHandler(settingsController.updateProfile.bind(settingsController)),
);

/** @openapi { "/settings/profile/contact": { patch: { tags: [Gym Settings], summary: "Update Contact Information (email, phone, alternate phone, website, address, city, state, country, postal code, latitude, longitude)", security: [{bearerAuth: []}], responses: { 200: { description: Contact information updated } } } } } */
settingsRouter.patch(
  '/profile/contact',
  canManage,
  validate({ body: updateContactInfoSchema }),
  asyncHandler(settingsController.updateContactInfo.bind(settingsController)),
);

/** @openapi { "/settings/profile/business-hours": { patch: { tags: [Gym Settings], summary: "Update Business Hours (per weekday open/close/closed)", security: [{bearerAuth: []}], responses: { 200: { description: Business hours updated } } } } } */
settingsRouter.patch(
  '/profile/business-hours',
  canManage,
  validate({ body: updateBusinessHoursSchema }),
  asyncHandler(settingsController.updateBusinessHours.bind(settingsController)),
);

/** @openapi { "/settings/profile/social-links": { patch: { tags: [Gym Settings], summary: "Update Social Media Links (Facebook, Instagram, Twitter, YouTube, LinkedIn)", security: [{bearerAuth: []}], responses: { 200: { description: Social media links updated } } } } } */
settingsRouter.patch(
  '/profile/social-links',
  canManage,
  validate({ body: updateSocialLinksSchema }),
  asyncHandler(settingsController.updateSocialLinks.bind(settingsController)),
);

/**
 * @openapi
 * /settings/business:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Business Settings (currency, timezone, date/time format, week start, measurement unit, language)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Business settings }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: "Update Business Settings — also covers Update Currency / Update Timezone / Update Date & Time Format / Update Language (all fields on this one resource, independently settable)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Business settings updated }
 */
settingsRouter.get(
  '/business',
  canRead,
  asyncHandler(settingsController.getBusinessSettings.bind(settingsController)),
);
settingsRouter.patch(
  '/business',
  canManage,
  validate({ body: updateBusinessSettingsSchema }),
  asyncHandler(settingsController.updateBusinessSettings.bind(settingsController)),
);

/**
 * @openapi
 * /settings/branding:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Branding (logo, favicon, colors, theme, login background, dashboard banner, email logo)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branding }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: Update Theme Colors (primary/secondary color, theme mode, welcome message)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branding updated }
 */
settingsRouter.get('/branding', canRead, asyncHandler(settingsController.getBranding.bind(settingsController)));
settingsRouter.patch(
  '/branding',
  canManage,
  validate({ body: updateBrandingSchema }),
  asyncHandler(settingsController.updateBranding.bind(settingsController)),
);

/** @openapi { "/settings/branding/logo": { post: { tags: [Gym Settings], summary: "Upload Gym Logo (base64 image data URL)", security: [{bearerAuth: []}], responses: { 200: { description: Logo uploaded } } } } } */
settingsRouter.post(
  '/branding/logo',
  canManage,
  validate({ body: uploadImageSchema }),
  asyncHandler(settingsController.uploadLogo.bind(settingsController)),
);

/** @openapi { "/settings/branding/favicon": { post: { tags: [Gym Settings], summary: "Upload Favicon (base64 image data URL)", security: [{bearerAuth: []}], responses: { 200: { description: Favicon uploaded } } } } } */
settingsRouter.post(
  '/branding/favicon',
  canManage,
  validate({ body: uploadImageSchema }),
  asyncHandler(settingsController.uploadFavicon.bind(settingsController)),
);

/** @openapi { "/settings/branding/upload": { post: { tags: [Gym Settings], summary: "Upload a branding image asset (login background, dashboard banner, or email logo)", security: [{bearerAuth: []}], responses: { 200: { description: Image uploaded } } } } } */
settingsRouter.post(
  '/branding/upload',
  canManage,
  validate({ body: uploadBrandingAssetSchema }),
  asyncHandler(settingsController.uploadBrandingAsset.bind(settingsController)),
);

/**
 * @openapi
 * /settings/invoice:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Invoice Settings (prefix, footer, tax percentage, default payment terms)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Invoice settings }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: "Update Invoice Settings — also covers Update Tax Information (tax percentage lives on this resource)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Invoice settings updated }
 */
settingsRouter.get(
  '/invoice',
  canRead,
  asyncHandler(settingsController.getInvoiceSettings.bind(settingsController)),
);
settingsRouter.patch(
  '/invoice',
  canManage,
  validate({ body: updateInvoiceSettingsSchema }),
  asyncHandler(settingsController.updateInvoiceSettings.bind(settingsController)),
);

/**
 * @openapi
 * /settings/email:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Email Settings (sender name/address used for outbound tenant emails)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Email settings }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: Update Email Settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Email settings updated }
 */
settingsRouter.get('/email', canRead, asyncHandler(settingsController.getEmailSettings.bind(settingsController)));
settingsRouter.patch(
  '/email',
  canManage,
  validate({ body: updateEmailSettingsSchema }),
  asyncHandler(settingsController.updateEmailSettings.bind(settingsController)),
);

/**
 * @openapi
 * /settings/notifications:
 *   get:
 *     tags: [Gym Settings]
 *     summary: Get Notification Preferences (tenant-wide email/push/SMS channel toggles)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification preferences }
 *   patch:
 *     tags: [Gym Settings]
 *     summary: Update Notification Preferences
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification preferences updated }
 */
settingsRouter.get(
  '/notifications',
  canRead,
  asyncHandler(settingsController.getNotificationSettings.bind(settingsController)),
);
settingsRouter.patch(
  '/notifications',
  canManage,
  validate({ body: updateNotificationSettingsSchema }),
  asyncHandler(settingsController.updateNotificationSettings.bind(settingsController)),
);
