/**
 * A deliberately small, conservative denylist — same spirit as
 * core/security/common-passwords.ts. This blocks obvious cases; it is not
 * a substitute for human moderation of a public-facing subdomain list.
 */
const PROFANITY_DENYLIST = new Set([
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn', 'crap', 'dick', 'cock',
  'pussy', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
  'rape', 'nazi', 'hitler', 'porn', 'sex', 'xxx',
]);

export function containsProfanity(slug: string): boolean {
  const normalized = slug.toLowerCase();
  for (const word of PROFANITY_DENYLIST) {
    if (normalized.includes(word)) return true;
  }
  return false;
}
