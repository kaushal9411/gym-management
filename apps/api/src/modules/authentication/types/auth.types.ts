/** System role names — seeded once, shared across every tenant (see prisma/seed.ts). */
export const SystemRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  TRAINER: 'TRAINER',
  RECEPTIONIST: 'RECEPTIONIST',
  MEMBER: 'MEMBER',
} as const;

export type SystemRoleName = (typeof SystemRole)[keyof typeof SystemRole];

export type OtpPurposeName = 'LOGIN_MFA' | 'EMAIL_VERIFICATION' | 'TWO_FACTOR';

export interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface IssuedTokenPair {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}
