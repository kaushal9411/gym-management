export type RazorpaySource = 'database' | 'environment' | 'none';
export type RazorpayMode = 'test' | 'live';

export interface RazorpayGateway {
  provider: 'RAZORPAY';
  source: RazorpaySource;
  configured: boolean;
  isEnabled: boolean;
  mode: RazorpayMode | null;
  keyId: string | null;
  keySecretSet: boolean;
  keySecretLast4: string | null;
  webhookSecretSet: boolean;
  webhookUrl: string;
  updatedAt: string | null;
}

export interface SaveRazorpayInput {
  keyId: string;
  keySecret?: string;
  webhookSecret?: string;
  isEnabled?: boolean;
}

export interface TestRazorpayInput {
  keyId?: string;
  keySecret?: string;
}

export interface TestRazorpayResult {
  ok: boolean;
  mode: RazorpayMode | null;
  message: string;
}
