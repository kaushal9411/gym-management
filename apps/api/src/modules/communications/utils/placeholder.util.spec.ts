import { describe, expect, it } from 'vitest';

import { CAMPAIGN_PLACEHOLDERS, findPlaceholderIssues, renderPlaceholders, SAMPLE_VARS, singleLine, usedPlaceholders } from './placeholder.util';

describe('findPlaceholderIssues', () => {
  it('accepts every known placeholder, with or without inner spaces', () => {
    const text = `${CAMPAIGN_PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')} {{ firstName }}`;
    expect(findPlaceholderIssues(text, CAMPAIGN_PLACEHOLDERS)).toEqual([]);
  });

  it('names every unknown placeholder once and lists the allowed ones', () => {
    const issues = findPlaceholderIssues('Hi {{nickname}} {{nickname}} {{ ssn }}', CAMPAIGN_PLACEHOLDERS);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('{{nickname}}');
    expect(issues[0]).toContain('{{firstName}}');
    expect(issues[1]).toContain('{{ssn}}');
  });

  it('flags half-written or stray braces', () => {
    expect(findPlaceholderIssues('Hello {{firstName', CAMPAIGN_PLACEHOLDERS)[0]).toMatch(/Malformed/);
    expect(findPlaceholderIssues('Hello firstName}}', CAMPAIGN_PLACEHOLDERS)[0]).toMatch(/Malformed/);
    expect(findPlaceholderIssues('Hello {{first name}}', CAMPAIGN_PLACEHOLDERS).join(' ')).toMatch(/Malformed/);
  });

  it('plain text with single braces is fine', () => {
    expect(findPlaceholderIssues('Offer {20% off} today', CAMPAIGN_PLACEHOLDERS)).toEqual([]);
  });
});

describe('renderPlaceholders', () => {
  it('fills known tokens and leaves unknown ones untouched', () => {
    expect(renderPlaceholders('Hi {{firstName}}, {{ planName }} ends {{endDate}} {{mystery}}', SAMPLE_VARS)).toBe('Hi Aarav, Monthly ends 26 Oct 2026 {{mystery}}');
  });

  it('renders money as INR, never dollars', () => {
    const out = renderPlaceholders('Due: {{amountDue}}', SAMPLE_VARS);
    expect(out).toBe('Due: ₹1,500');
    expect(out).not.toMatch(/\$|USD/);
  });
});

describe('helpers', () => {
  it('usedPlaceholders returns each name once in order', () => {
    expect(usedPlaceholders('{{lastName}} {{firstName}} {{lastName}}')).toEqual(['lastName', 'firstName']);
  });
  it('singleLine collapses newlines for subjects / push titles', () => {
    expect(singleLine('Hello\r\nthere\n  friend ')).toBe('Hello there friend');
  });
});
