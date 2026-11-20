/**
 * Client-side checks for the home-page contact form. They mirror the API's
 * `contactRequestSchema` (apps/api/src/modules/contact/validators) so people
 * see the problem next to the field instead of after a round trip. The server
 * stays the source of truth: its 422 messages are mapped back onto the same fields.
 */

export const CONTACT_TOPICS = [
  { value: 'sales', label: 'Pricing and plans' },
  { value: 'demo', label: 'Book a demo' },
  { value: 'billing', label: 'Billing question' },
  { value: 'general', label: 'Something else' },
] as const;

export const GYM_SIZES = [
  { value: 'under-100', label: 'Under 100 members' },
  { value: '100-300', label: '100 to 300 members' },
  { value: '300-1000', label: '300 to 1,000 members' },
  { value: 'over-1000', label: 'Over 1,000 members' },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value'];

export interface ContactFormValues {
  topic: ContactTopic;
  name: string;
  email: string;
  phone: string;
  gymName: string;
  gymSize: string;
  message: string;
  /** Honeypot. Hidden from people; bots fill it. */
  website: string;
}

export type ContactField = 'name' | 'email' | 'phone' | 'gymName' | 'message';
export type ContactErrors = Partial<Record<ContactField, string>>;

export const EMPTY_CONTACT: ContactFormValues = { topic: 'sales', name: '', email: '', phone: '', gymName: '', gymSize: '', message: '', website: '' };

export const MESSAGE_MAX = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9\s-]{7,15}$/;

export function validateContact(v: ContactFormValues): ContactErrors {
  const errors: ContactErrors = {};
  const name = v.name.trim();
  if (name.length < 2) errors.name = 'Enter your name.';
  else if (name.length > 120) errors.name = 'Keep your name under 120 characters.';

  const email = v.email.trim();
  if (!email) errors.email = 'Enter your email so we can reply.';
  else if (!EMAIL.test(email)) errors.email = 'This email does not look right.';

  const phone = v.phone.trim();
  if (phone && !PHONE.test(phone)) errors.phone = 'Use 7 to 15 digits. You can start with +.';

  if (v.gymName.trim().length > 120) errors.gymName = 'Keep the gym name under 120 characters.';

  const message = v.message.trim();
  if (message.length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  else if (message.length > MESSAGE_MAX) errors.message = `Keep it under ${MESSAGE_MAX} characters.`;
  return errors;
}

/** Maps the API's `errors[]` (`{ field, message }`) onto the form's fields; unknown fields are dropped. */
export function mapServerErrors(errors: Array<{ field?: string; message?: string }> | null | undefined): ContactErrors {
  const out: ContactErrors = {};
  const known: ContactField[] = ['name', 'email', 'phone', 'gymName', 'message'];
  for (const e of errors ?? []) {
    const f = e.field as ContactField | undefined;
    if (f && known.includes(f) && e.message && !out[f]) out[f] = e.message;
  }
  return out;
}
