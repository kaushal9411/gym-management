import { describe, expect, it } from 'vitest';

import { jwtService } from './jwt.service';

describe('JwtService', () => {
  const baseInput = {
    userId: 'usr_123',
    tenantId: 'tnt_456',
    role: 'OWNER',
    roles: ['OWNER'],
    permVer: 1,
    sessionId: 'ses_789',
  };

  it('signs a token that verifies back to the same claims', () => {
    const { token } = jwtService.signAccessToken(baseInput);
    const claims = jwtService.verifyAccessToken(token);

    expect(claims.sub).toBe(baseInput.userId);
    expect(claims.tenantId).toBe(baseInput.tenantId);
    expect(claims.role).toBe(baseInput.role);
    expect(claims.sid).toBe(baseInput.sessionId);
  });

  it('rejects a tampered token', () => {
    const { token } = jwtService.signAccessToken(baseInput);
    const tampered = `${token.slice(0, -2)}xx`;

    expect(() => jwtService.verifyAccessToken(tampered)).toThrow();
  });

  it('issues a unique jti per token', () => {
    const first = jwtService.signAccessToken(baseInput);
    const second = jwtService.signAccessToken(baseInput);
    expect(first.jti).not.toBe(second.jti);
  });
});
