export type CmsPageType = 'FAQ' | 'TERMS' | 'PRIVACY' | 'COOKIE';

export interface CmsPage {
  id: string;
  slug: string;
  type: CmsPageType;
  title: string;
  /** Shape depends on `type` — FAQ: `{ answer: string }`; TERMS/PRIVACY/COOKIE: `{ body: string }`. */
  content: Record<string, unknown>;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
