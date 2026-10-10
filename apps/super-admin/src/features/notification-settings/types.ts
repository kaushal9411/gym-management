export interface PlatformNotificationCredentials {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpPasswordMasked: string | null;
  smtpFromName: string | null;
  smtpFromAddress: string | null;
  kaleyraSid: string | null;
  hasKaleyraApiKey: boolean;
  kaleyraApiKeyMasked: string | null;
  kaleyraApiDomain: string | null;
  kaleyraSmsSenderId: string | null;
  kaleyraWhatsappNumber: string | null;
  kaleyraConfigured: boolean;
}

export interface UpdatePlatformNotificationCredentialsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromAddress?: string;
  kaleyraSid?: string;
  kaleyraApiKey?: string;
  kaleyraApiDomain?: string;
  kaleyraSmsSenderId?: string;
  kaleyraWhatsappNumber?: string;
}
