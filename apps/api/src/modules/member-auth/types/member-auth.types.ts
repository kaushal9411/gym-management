export interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface MemberProfileDto {
  id: string;
  memberId: string;
  name: string;
  email: string | null;
  status: string;
}

export interface MemberAuthSuccess {
  member: MemberProfileDto;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}
