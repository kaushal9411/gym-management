/** Shapes returned to clients — decoupled from Prisma models on purpose. */

export interface UserProfileDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  roles: string[];
  /** Union of permission keys across every role the user holds (see RoleRepository). */
  permissions: string[];
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthSuccessDto {
  user: UserProfileDto;
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Refresh token is ALSO set as an httpOnly cookie — returned here too for
   *  non-browser clients (mobile) that can't rely on cookies. */
  refreshToken: string;
}

export interface OtpChallengeDto {
  challenge: 'otp_required';
  email: string;
  purpose: OtpPurposeDto;
  expiresInSeconds: number;
}

export type OtpPurposeDto = 'login' | '2fa';

export type LoginResultDto = AuthSuccessDto | OtpChallengeDto;

export interface SessionDto {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}
