export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  expiresAt: string | null;
}
