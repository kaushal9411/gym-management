/** Placeholders a staff-authored campaign may use. */
export const CAMPAIGN_PLACEHOLDERS = ['firstName', 'lastName', 'memberCode', 'planName', 'endDate', 'amountDue', 'gymName'] as const;
export type CampaignPlaceholder = (typeof CAMPAIGN_PLACEHOLDERS)[number];

/** `{{ name }}` — whitespace inside the braces is tolerated, names are word characters only. */
const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Sample values used by previews and test-sends. */
export const SAMPLE_VARS: Record<string, string> = {
  firstName: 'Aarav',
  lastName: 'Kapoor',
  memberCode: 'MEM-0001',
  planName: 'Monthly',
  endDate: '26 Oct 2026',
  amountDue: '₹1,500',
  gymName: 'Your Gym',
  daysLeft: '3',
  daysAway: '14',
  invoiceNumber: 'INV-0042',
  dueDate: '22 Oct 2026',
  className: 'Evening HIIT',
  classDate: '23 Oct 2026',
  classTime: '6:30 pm',
  memberName: 'Aarav Kapoor',
  expiryStatus: 'expires in 3 day(s)',
  amount: '₹1,500',
  tenantName: 'Your Gym',
};

/**
 * Human-readable problems with the placeholders in `text` (empty array = OK).
 * Unknown names are named explicitly; stray or half-written braces get their own message.
 */
export function findPlaceholderIssues(text: string, allowed: readonly string[]): string[] {
  const issues: string[] = [];
  const unknown = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1]!;
    if (!allowed.includes(name)) unknown.add(name);
  }
  for (const name of unknown) {
    issues.push(`Unknown placeholder {{${name}}}. Allowed: ${allowed.map((p) => `{{${p}}}`).join(' ')}`);
  }
  const leftover = text.replace(TOKEN, '');
  if (leftover.includes('{{') || leftover.includes('}}')) {
    issues.push('Malformed placeholder: every "{{" or "}}" must be part of a complete {{name}}.');
  }
  return issues;
}

/** Names of the placeholders actually used in `text` (deduped, in order of first use). */
export function usedPlaceholders(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1]!;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** Substitutes known `{{name}}` tokens; an unknown token is left untouched. */
export function renderPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(TOKEN, (whole, name: string) => vars[name] ?? whole);
}

/** Subject lines / push titles must be one line. */
export function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
