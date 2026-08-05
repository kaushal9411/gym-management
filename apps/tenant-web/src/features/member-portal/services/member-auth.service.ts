import { memberApiClient, toMemberAuthServiceError } from './member-api-client';
import type { MemberProfile, MemberSessionTokens } from '../types';

interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export const memberAuthService = {
  async login(memberId: string, password: string): Promise<{ member: MemberProfile; tokens: MemberSessionTokens }> {
    try {
      const res = await memberApiClient.post<Envelope<{ member: MemberProfile } & MemberSessionTokens>>('/member/auth/login', { memberId, password });
      const { member, ...tokens } = res.data.data;
      return { member, tokens };
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await memberApiClient.post('/member/auth/logout', { refreshToken });
    } catch {
      // Best-effort — the client-side sign-out happens regardless.
    }
  },

  async lookupActivation(token: string): Promise<{ memberName: string; expiresAt: string }> {
    try {
      const res = await memberApiClient.get<Envelope<{ memberName: string; expiresAt: string }>>(`/member/auth/activate/${token}`);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async acceptActivation(token: string, password: string): Promise<void> {
    try {
      await memberApiClient.post('/member/auth/activate', { token, password });
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async forgotPassword(memberId: string): Promise<void> {
    try {
      await memberApiClient.post('/member/auth/forgot-password', { memberId });
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async lookupPasswordReset(token: string): Promise<{ memberName: string; expiresAt: string }> {
    try {
      const res = await memberApiClient.get<Envelope<{ memberName: string; expiresAt: string }>>(`/member/auth/reset-password/${token}`);
      return res.data.data;
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },

  async resetPassword(token: string, password: string): Promise<void> {
    try {
      await memberApiClient.post('/member/auth/reset-password', { token, password });
    } catch (error) {
      throw toMemberAuthServiceError(error);
    }
  },
};
