import { describe, expect, it } from 'vitest';

import { sanitizeRichText } from './html-sanitizer.util';

describe('sanitizeRichText', () => {
  it('keeps every tag the RichTextEditor toolbar can actually produce', () => {
    const input = '<div><b>bold</b> <i>italic</i> <u>underline</u></div><ul><li>one</li><li>two</li></ul>';
    expect(sanitizeRichText(input)).toBe(input);
  });

  it('keeps a link but forces rel="noopener noreferrer" and target="_blank"', () => {
    const out = sanitizeRichText('<a href="https://example.com">click</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('strips a <script> tag entirely', () => {
    expect(sanitizeRichText('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips an inline event-handler attribute even on an allowed tag', () => {
    const out = sanitizeRichText('<div onclick="alert(1)">click me</div>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('click me');
  });

  it('strips a javascript: link href instead of passing it through', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">bad link</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips an <iframe>', () => {
    expect(sanitizeRichText('<p>text</p><iframe src="https://evil.example"></iframe>')).toBe('<p>text</p>');
  });

  it('strips a style attribute (not on the allowlist)', () => {
    const out = sanitizeRichText('<div style="background:url(javascript:alert(1))">x</div>');
    expect(out).not.toContain('style=');
  });
});
