export type CmsPageType = 'LANDING' | 'BLOG' | 'FAQ' | 'TESTIMONIAL' | 'TERMS' | 'PRIVACY' | 'COOKIE';

export interface CmsPage {
  id: string;
  slug: string;
  type: CmsPageType;
  title: string;
  content: unknown;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCmsPageInput {
  slug: string;
  type: CmsPageType;
  title: string;
  content: unknown;
  isPublished: boolean;
}
