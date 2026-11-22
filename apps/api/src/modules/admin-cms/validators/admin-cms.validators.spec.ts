import { describe, expect, it } from 'vitest';

import { CMS_PAGE_TYPES, createCmsPageSchema, cmsPageQuerySchema, publicCmsPageQuerySchema } from './admin-cms.validators';

describe('CMS page types', () => {
  it('only manages FAQ and the legal pages', () => {
    expect([...CMS_PAGE_TYPES]).toEqual(['FAQ', 'TERMS', 'PRIVACY', 'COOKIE']);
  });

  it.each(['LANDING', 'BLOG', 'TESTIMONIAL'])('rejects the removed type %s everywhere', (type) => {
    expect(createCmsPageSchema.safeParse({ slug: 'x', type, title: 'T', content: {} }).success).toBe(false);
    expect(cmsPageQuerySchema.safeParse({ type }).success).toBe(false);
    expect(publicCmsPageQuerySchema.safeParse({ type }).success).toBe(false);
  });

  it('still accepts FAQ, TERMS, PRIVACY and COOKIE', () => {
    for (const type of ['FAQ', 'TERMS', 'PRIVACY', 'COOKIE']) {
      expect(createCmsPageSchema.safeParse({ slug: 'x', type, title: 'T', content: {} }).success).toBe(true);
    }
  });
});
