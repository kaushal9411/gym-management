import type { CmsPageType } from './types';

export const PAGE_TYPES: CmsPageType[] = ['FAQ', 'TERMS', 'PRIVACY', 'COOKIE'];

export const PAGE_TYPE_META: Record<CmsPageType, { label: string; description: string }> = {
  FAQ: { label: 'FAQ', description: 'One question + answer, shown in the Help Center (Support) of every gym portal.' },
  TERMS: { label: 'Terms of Service', description: 'Shown at /terms — linked from the signup form.' },
  PRIVACY: { label: 'Privacy Policy', description: 'Shown at /privacy — linked from the signup form.' },
  COOKIE: { label: 'Cookie Policy', description: 'Cookie usage disclosure.' },
};

/** The key inside `content` this type's body lives under — everything except FAQ uses `body`; FAQ uses `answer` since its `title` is already the question. */
export function contentKeyFor(type: CmsPageType): 'answer' | 'body' {
  return type === 'FAQ' ? 'answer' : 'body';
}

const LEGAL_DISCLAIMER =
  '<p><em>⚠️ Placeholder starter text — have this reviewed by legal counsel and replace it with your own before publishing.</em></p>';

/** Pre-filled starting content offered when creating a new page of each type — never auto-published (`isPublished` still defaults false), so nothing goes live without a deliberate edit + publish. */
export const DEFAULT_CONTENT: Record<CmsPageType, string> = {
  FAQ: '<p>Write the answer to this question here.</p>',
  TERMS: [
    LEGAL_DISCLAIMER,
    '<h2>1. Acceptance of Terms</h2>',
    '<p>By accessing or using this service, you agree to be bound by these terms.</p>',
    '<h2>2. Use of Service</h2>',
    '<p>You agree to use the service only for lawful purposes and in accordance with these terms.</p>',
    '<h2>3. Termination</h2>',
    '<p>We may suspend or terminate your access at any time for violation of these terms.</p>',
    '<h2>4. Limitation of Liability</h2>',
    '<p>The service is provided "as is" without warranties of any kind.</p>',
    '<h2>5. Changes to Terms</h2>',
    '<p>We may update these terms from time to time. Continued use constitutes acceptance of the changes.</p>',
    '<h2>6. Contact</h2>',
    '<p>Questions about these terms? Contact us at support@example.com.</p>',
  ].join('\n'),
  PRIVACY: [
    LEGAL_DISCLAIMER,
    '<h2>1. Information We Collect</h2>',
    '<p>We collect information you provide directly, such as your name, email, and payment details.</p>',
    '<h2>2. How We Use Your Information</h2>',
    '<p>We use your information to provide, maintain, and improve our services.</p>',
    '<h2>3. Data Sharing</h2>',
    '<p>We do not sell your personal information. We may share it with service providers who help us operate the platform.</p>',
    '<h2>4. Cookies</h2>',
    '<p>We use cookies to keep you signed in and understand how you use our service.</p>',
    '<h2>5. Your Rights</h2>',
    '<p>You may request access to, correction of, or deletion of your personal data at any time.</p>',
    '<h2>6. Contact</h2>',
    '<p>Questions about this policy? Contact us at privacy@example.com.</p>',
  ].join('\n'),
  COOKIE: [
    LEGAL_DISCLAIMER,
    '<h2>What Are Cookies</h2>',
    '<p>Cookies are small text files stored on your device to help our service function properly.</p>',
    '<h2>How We Use Cookies</h2>',
    '<p>We use essential cookies for authentication and optional cookies for analytics.</p>',
    '<h2>Managing Cookies</h2>',
    '<p>You can control cookies through your browser settings at any time.</p>',
  ].join('\n'),
};

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
