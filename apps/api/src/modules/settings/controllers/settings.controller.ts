import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  UpdateBrandingInput,
  UpdateBusinessSettingsInput,
  UpdateContactInfoInput,
  UpdateEmailSettingsInput,
  UpdateGymProfileInput,
  UpdateInvoiceSettingsInput,
  UpdateNotificationSettingsInput,
} from '../dto/settings.dto';
import { SettingsService } from '../services/settings.service';

function serviceFor(req: Request): SettingsService {
  return new SettingsService(req.tenant!.id, req.tenant!.slug);
}

export class SettingsController {
  // ── Gym Profile ─────────────────────────────────────────────────────
  async getProfile(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getProfile());
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const profile = await serviceFor(req).updateProfile(req.body as UpdateGymProfileInput, actorFrom(req));
    sendSuccess(res, profile, 'Gym profile updated.');
  }

  async updateContactInfo(req: Request, res: Response): Promise<void> {
    const profile = await serviceFor(req).updateContactInfo(req.body as UpdateContactInfoInput, actorFrom(req));
    sendSuccess(res, profile, 'Contact information updated.');
  }

  async updateBusinessHours(req: Request, res: Response): Promise<void> {
    const profile = await serviceFor(req).updateBusinessHours(req.body, actorFrom(req));
    sendSuccess(res, profile, 'Business hours updated.');
  }

  async updateSocialLinks(req: Request, res: Response): Promise<void> {
    const profile = await serviceFor(req).updateSocialLinks(req.body, actorFrom(req));
    sendSuccess(res, profile, 'Social media links updated.');
  }

  // ── Business Settings ───────────────────────────────────────────────
  async getBusinessSettings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getBusinessSettings());
  }

  async updateBusinessSettings(req: Request, res: Response): Promise<void> {
    const settings = await serviceFor(req).updateBusinessSettings(req.body as UpdateBusinessSettingsInput, actorFrom(req));
    sendSuccess(res, settings, 'Business settings updated.');
  }

  // ── Branding ─────────────────────────────────────────────────────────
  async getBranding(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getBranding());
  }

  async updateBranding(req: Request, res: Response): Promise<void> {
    const branding = await serviceFor(req).updateBranding(req.body as UpdateBrandingInput, actorFrom(req));
    sendSuccess(res, branding, 'Theme colors updated.');
  }

  async uploadLogo(req: Request, res: Response): Promise<void> {
    const { dataUrl } = req.body as { dataUrl: string };
    const branding = await serviceFor(req).uploadLogo(dataUrl, actorFrom(req));
    sendSuccess(res, branding, 'Logo uploaded.');
  }

  async uploadFavicon(req: Request, res: Response): Promise<void> {
    const { dataUrl } = req.body as { dataUrl: string };
    const branding = await serviceFor(req).uploadFavicon(dataUrl, actorFrom(req));
    sendSuccess(res, branding, 'Favicon uploaded.');
  }

  async uploadBrandingAsset(req: Request, res: Response): Promise<void> {
    const { field, dataUrl } = req.body as {
      field: 'loginBackgroundUrl' | 'dashboardBannerUrl' | 'emailLogoUrl';
      dataUrl: string;
    };
    const branding = await serviceFor(req).uploadBrandingAsset(field, dataUrl, actorFrom(req));
    sendSuccess(res, branding, 'Image uploaded.');
  }

  // ── Invoice Settings ─────────────────────────────────────────────────
  async getInvoiceSettings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getInvoiceSettings());
  }

  async updateInvoiceSettings(req: Request, res: Response): Promise<void> {
    const settings = await serviceFor(req).updateInvoiceSettings(req.body as UpdateInvoiceSettingsInput, actorFrom(req));
    sendSuccess(res, settings, 'Invoice settings updated.');
  }

  // ── Email Settings ───────────────────────────────────────────────────
  async getEmailSettings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getEmailSettings());
  }

  async updateEmailSettings(req: Request, res: Response): Promise<void> {
    const settings = await serviceFor(req).updateEmailSettings(req.body as UpdateEmailSettingsInput, actorFrom(req));
    sendSuccess(res, settings, 'Email settings updated.');
  }

  // ── Notification Preferences ─────────────────────────────────────────
  async getNotificationSettings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getNotificationSettings());
  }

  async updateNotificationSettings(req: Request, res: Response): Promise<void> {
    const settings = await serviceFor(req).updateNotificationSettings(
      req.body as UpdateNotificationSettingsInput,
      actorFrom(req),
    );
    sendSuccess(res, settings, 'Notification preferences updated.');
  }
}

export const settingsController = new SettingsController();
