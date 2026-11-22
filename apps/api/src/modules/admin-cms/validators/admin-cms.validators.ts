import { z } from 'zod';

/**
 * The only page types the CMS manages: help-centre FAQs and the legal pages. LANDING / BLOG / TESTIMONIAL were removed from the product
 * (nothing ever rendered them); the Prisma enum still lists them to avoid a destructive migration, so they are rejected here and hidden from lists.
 */
export const CMS_PAGE_TYPES = ['FAQ', 'TERMS', 'PRIVACY', 'COOKIE'] as const;

export const createCmsPageSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(160).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  type: z.enum(CMS_PAGE_TYPES),
  title: z.string().trim().min(1).max(200),
  content: z.unknown(),
  isPublished: z.boolean().default(false),
});

export const updateCmsPageSchema = createCmsPageSchema.omit({ slug: true }).partial();

export const cmsPageSlugParamSchema = z.object({ slug: z.string().trim().min(1) });

export const cmsPageQuerySchema = z.object({ type: z.enum(CMS_PAGE_TYPES).optional() });

/** Public read (Prompt 81) — `type` is required, unlike the admin list above, so a public caller can't dump every page type in one request. */
export const publicCmsPageQuerySchema = z.object({ type: z.enum(CMS_PAGE_TYPES) });
