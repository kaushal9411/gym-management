export interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminProfileDto {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  lastLoginAt: string | null;
}

export interface AdminSessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

export interface AdminAuthSuccess {
  admin: AdminProfileDto;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}
