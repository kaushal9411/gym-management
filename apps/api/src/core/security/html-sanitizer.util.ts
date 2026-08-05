import sanitizeHtml from 'sanitize-html';

/**
 * Strips anything the tenant-web `RichTextEditor` (`document.execCommand`
 * bold/italic/underline/list/link only) could never actually produce —
 * scripts, event handlers, iframes, style/class attributes, `javascript:`
 * links — before a tenant announcement's `body` is persisted. This is the
 * one place that runs; the render side (`dangerouslySetInnerHTML` on
 * `/announcements`) trusts whatever's already in the database, so nothing
 * unsafe may ever reach it in the first place.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'p', 'br', 'div', 'span'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}
