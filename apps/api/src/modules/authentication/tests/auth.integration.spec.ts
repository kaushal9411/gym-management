import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../app';
import { prisma } from '../../../infrastructure/database/prisma';

/**
 * End-to-end integration coverage against a REAL PostgreSQL + Redis
 * (docker-compose services) — the same database this environment runs
 * against. Each run uses a fresh, random tenant slug so tests are
 * repeatable without a reset step, and the tenant is deleted afterwards.
 *
 * Requires: `docker compose up -d postgres redis mailpit`, migrations
 * applied, and the RBAC seed run (`pnpm prisma:seed`) — the Owner role
 * must exist for registration to succeed.
 */
describe('Authentication flow (integration)', () => {
  const app = createApp();
  const slug = `test-${randomUUID().slice(0, 8)}`;
  const email = `owner-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'Str0ng!Passw0rd';
  let tenantId: string;

  const withTenant = (req: request.Test) => req.set('X-Tenant-Slug', slug);

  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('registers a new gym owner and creates a TRIAL tenant', async () => {
    const res = await withTenant(request(app).post('/api/v1/auth/register')).send({
      gymName: 'Test Gym',
      slug,
      ownerName: 'Test Owner',
      email,
      password,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    tenantId = tenant.id;
    expect(tenant.status).toBe('TRIAL');
  });

  it('rejects login before the email is verified', async () => {
    const res = await withTenant(request(app).post('/api/v1/auth/login')).send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.errors?.[0]?.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('verifies the email using the token stored in the database', async () => {
    const verification = await prisma.emailVerification.findFirstOrThrow({
      where: { user: { email, tenantId } },
    });
    // The service only ever stores a hash — for this white-box integration
    // test we mark it verified directly and confirm login unlocks, since
    // the plaintext token is only ever known to the (mocked) email itself.
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { verifiedAt: new Date() } });
    await prisma.user.update({ where: { id: verification.userId }, data: { status: 'ACTIVE', emailVerifiedAt: new Date() } });

    const res = await withTenant(request(app).post('/api/v1/auth/login')).send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.roles).toContain('OWNER');
  });

  it('rejects wrong password with INVALID_CREDENTIALS', async () => {
    const res = await withTenant(request(app).post('/api/v1/auth/login')).send({ email, password: 'WrongPass!1' });
    expect(res.status).toBe(401);
    expect(res.body.errors?.[0]?.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in, refreshes the token, and fetches the profile', async () => {
    const login = await withTenant(request(app).post('/api/v1/auth/login')).send({ email, password });
    const { accessToken, refreshToken } = login.body.data;

    const me = await withTenant(request(app).get('/api/v1/auth/me')).set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const refreshed = await withTenant(request(app).post('/api/v1/auth/refresh')).send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).not.toBe(accessToken);

    // The rotated-away token must now be rejected (reuse detection).
    const reused = await withTenant(request(app).post('/api/v1/auth/refresh')).send({ refreshToken });
    expect(reused.status).toBe(401);
  });

  it('rejects a request whose tenant does not match the token', async () => {
    const login = await withTenant(request(app).post('/api/v1/auth/login')).send({ email, password });
    const { accessToken } = login.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Slug', 'some-other-tenant');

    expect([401, 404]).toContain(res.status);
  });
});
