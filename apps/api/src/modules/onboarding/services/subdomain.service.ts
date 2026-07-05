import { tenantRepository } from '../../tenants/repository/tenant.repository';
import { RESERVED_SLUGS, SLUG_PATTERN } from '../../tenants/types/tenant.types';
import { containsProfanity } from '../utils/profanity-filter';

export interface SubdomainCheckResult {
  slug: string;
  available: boolean;
  reason?: string;
  suggestions: string[];
}

const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

function isStructurallyValid(slug: string): string | null {
  if (slug.length < MIN_LENGTH) return `Must be at least ${MIN_LENGTH} characters`;
  if (slug.length > MAX_LENGTH) return `Must be at most ${MAX_LENGTH} characters`;
  if (!SLUG_PATTERN.test(slug)) return 'Only lowercase letters, numbers, and hyphens (not at the start/end)';
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is a reserved name`;
  if (containsProfanity(slug)) return 'This subdomain is not allowed';
  return null;
}

/**
 * Live availability checker for the wizard's subdomain step — never
 * throws; always resolves to a result the UI can render directly,
 * including alternative suggestions when the requested slug is taken.
 */
export class SubdomainService {
  async check(rawSlug: string): Promise<SubdomainCheckResult> {
    const slug = normalize(rawSlug);
    const structuralIssue = isStructurallyValid(slug);
    if (structuralIssue) {
      return { slug, available: false, reason: structuralIssue, suggestions: [] };
    }

    const taken = await tenantRepository.slugExists(slug);
    if (!taken) {
      return { slug, available: true, suggestions: [] };
    }

    return {
      slug,
      available: false,
      reason: `"${slug}" is already in use`,
      suggestions: await this.generateSuggestions(slug),
    };
  }

  /** Tries a handful of natural variations, keeping only ones that are actually available. */
  private async generateSuggestions(baseSlug: string): Promise<string[]> {
    const candidates = [
      `${baseSlug}01`,
      `${baseSlug}gym`,
      `${baseSlug}fit`,
      `${baseSlug}pro`,
      `the${baseSlug}`,
      `${baseSlug}hq`,
    ].filter((c) => c.length <= MAX_LENGTH);

    const available: string[] = [];
    for (const candidate of candidates) {
      if (available.length >= 3) break;
      if (isStructurallyValid(candidate)) continue;
      if (!(await tenantRepository.slugExists(candidate))) available.push(candidate);
    }
    return available;
  }
}

export const subdomainService = new SubdomainService();
