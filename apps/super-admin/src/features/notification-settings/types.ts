export interface PlatformNotificationCredentials {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpPasswordMasked: string | null;
  smtpFromName: string | null;
  smtpFromAddress: string | null;
  twilioAccountSid: string | null;
  hasTwilioAuthToken: boolean;
  twilioAuthTokenMasked: string | null;
  twilioSmsFromNumber: string | null;
  twilioWhatsappFromNumber: string | null;
  twilioConfigured: boolean;
}

export interface UpdatePlatformNotificationCredentialsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromAddress?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioSmsFromNumber?: string;
  twilioWhatsappFromNumber?: string;
}
