import { describe, expect, it } from 'vitest';

import {
  memberProfilePhotoSchema,
  memberProfileUpdateSchema,
} from '../validators/member-portal.validators';

import {
  assertEmailChangeAuthorized,
  assertMemberPhotoDataUrl,
  buildProfileUpdate,
  EDITABLE_PROFILE_FIELDS,
} from './member-profile.util';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const dataUrl = (buf: Buffer, mime = 'image/png') =>
  `data:${mime};base64,${buf.toString('base64')}`;

describe('memberProfileUpdateSchema (strict whitelist)', () => {
  it.each([
    'status',
    'memberId',
    'branchId',
    'trainerId',
    'biometricId',
    'notes',
    'referredByMemberId',
    'qrCodeToken',
    'profilePhotoUrl',
    'medicalConditions',
    'allergies',
    'healthAsthma',
    'registrationFee',
    'id',
    'tenantId',
  ])('rejects locked/unknown key %s', (key) => {
    const r = memberProfileUpdateSchema.safeParse({ city: 'Pune', [key]: 'x' });
    expect(r.success).toBe(false);
  });

  it('accepts a normal partial patch and clears optionals on empty string', () => {
    const r = memberProfileUpdateSchema.parse({
      city: '',
      phone: '+91 98765 43210',
      goal: '',
      height: '180',
    });
    expect(r).toMatchObject({ city: null, phone: '+91 98765 43210', goal: null, height: 180 });
  });

  it('refuses to blank first/last name and bad values with friendly messages', () => {
    expect(memberProfileUpdateSchema.safeParse({ firstName: '' }).success).toBe(false);
    expect(memberProfileUpdateSchema.safeParse({ phone: 'abc' }).success).toBe(false);
    expect(memberProfileUpdateSchema.safeParse({ dateOfBirth: '2999-01-01' }).success).toBe(false);
    expect(memberProfileUpdateSchema.safeParse({ goal: 'FLY' }).success).toBe(false);
  });

  it('every editable field is in the schema', () => {
    for (const f of EDITABLE_PROFILE_FIELDS)
      expect(Object.keys(memberProfileUpdateSchema.shape)).toContain(f);
  });

  it('photo schema is strict', () => {
    expect(memberProfilePhotoSchema.safeParse({ image: 'x', memberId: 'y' }).success).toBe(false);
  });
});

describe('buildProfileUpdate', () => {
  const existing = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@x.com',
    phone: '111',
    height: '170.00',
    dateOfBirth: new Date('1990-01-01'),
    goal: 'WEIGHT_LOSS',
  };

  it('only writes changed whitelisted fields and reports names, not values', () => {
    const plan = buildProfileUpdate(
      { firstName: 'A', phone: '222', goal: 'ENDURANCE', height: 170, city: null },
      existing,
    );
    expect([...plan.changedFields].sort()).toEqual(['goal', 'phone']);
    expect(plan.enumChanges).toEqual({ goal: { from: 'WEIGHT_LOSS', to: 'ENDURANCE' } });
    expect(plan.data).toEqual({ phone: '222', goal: 'ENDURANCE' });
  });

  it('ignores unknown keys (no mass assignment) and treats same email (case-insensitive) as unchanged', () => {
    const plan = buildProfileUpdate({ email: 'A@X.com', status: 'INACTIVE' } as never, existing);
    expect(plan.changedFields).toEqual([]);
    expect(plan.data).toEqual({});
    expect(plan.emailChanged).toBe(false);
  });
});

describe('email-change guard', () => {
  it('requires a password when the email changes', () => {
    const plan = buildProfileUpdate({ email: 'new@x.com' }, { email: 'a@x.com' });
    expect(plan.emailChanged).toBe(true);
    expect(() => assertEmailChangeAuthorized(plan, undefined)).toThrow();
    expect(() => assertEmailChangeAuthorized(plan, 'pw')).not.toThrow();
  });
});

describe('assertMemberPhotoDataUrl', () => {
  it('accepts a real PNG', () =>
    expect(() => assertMemberPhotoDataUrl(dataUrl(PNG))).not.toThrow());
  it('ignores the claimed mime and rejects SVG bytes', () => {
    expect(() =>
      assertMemberPhotoDataUrl(
        dataUrl(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png'),
      ),
    ).toThrow();
  });
  it('rejects GIF and PDF', () => {
    expect(() =>
      assertMemberPhotoDataUrl(dataUrl(Buffer.from('GIF89a....'), 'image/gif')),
    ).toThrow();
    expect(() =>
      assertMemberPhotoDataUrl(dataUrl(Buffer.from('%PDF-1.4 xx'), 'image/jpeg')),
    ).toThrow();
  });
  it('rejects oversize and non-data-URL input', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(800_000)]);
    expect(() => assertMemberPhotoDataUrl(dataUrl(big))).toThrow();
    expect(() => assertMemberPhotoDataUrl('https://evil.example/x.png')).toThrow();
  });
});
