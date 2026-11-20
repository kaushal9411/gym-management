import { mapServerErrors, type ContactErrors, type ContactFormValues } from '../lib/contact-validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type ContactResult =
  | { ok: true; message: string }
  | { ok: false; kind: 'validation'; fieldErrors: ContactErrors; message: string }
  | { ok: false; kind: 'rate-limit' | 'network' | 'server'; message: string };

interface ApiBody {
  message?: string;
  errors?: Array<{ field?: string; message?: string }> | null;
}

/**
 * Posts the home-page form to the public contact endpoint (no login, no gym).
 * The endpoint stores it as a lead for the platform team and emails the sales
 * inbox. Never throws: every outcome comes back as a `ContactResult`.
 */
export async function submitContact(values: ContactFormValues): Promise<ContactResult> {
  const body = {
    topic: values.topic,
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    gymName: values.gymName.trim(),
    gymSize: values.gymSize,
    message: values.message.trim(),
    website: values.website,
    source: 'HOME_PAGE',
  };
  try {
    const res = await fetch(`${API_URL}/public/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as ApiBody;
    if (res.ok) return { ok: true, message: json.message ?? 'Thanks, we have your message and will reply within one business day.' };
    if (res.status === 422) {
      return { ok: false, kind: 'validation', fieldErrors: mapServerErrors(json.errors), message: 'Please fix the highlighted fields.' };
    }
    if (res.status === 429) {
      return { ok: false, kind: 'rate-limit', message: 'You have sent a few messages already. Please try again in an hour, or write to us from the email on your account.' };
    }
    return { ok: false, kind: 'server', message: 'We could not send your message. Please try again in a moment.' };
  } catch {
    return { ok: false, kind: 'network', message: 'Could not reach the server. Check your connection and try again.' };
  }
}
