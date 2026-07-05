import { z } from 'zod';

const CMS_PAGE_TYPES = ['LANDING', 'BLOG', 'FAQ', 'TESTIMONIAL', 'TERMS', 'PRIVACY', 'COOKIE'] as const;

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
