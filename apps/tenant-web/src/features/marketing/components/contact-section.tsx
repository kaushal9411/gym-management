'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, Send } from 'lucide-react';

import { SectionHead } from './content-sections';
import { submitContact } from '../services/contact.service';
import {
  CONTACT_TOPICS,
  EMPTY_CONTACT,
  GYM_SIZES,
  MESSAGE_MAX,
  validateContact,
  type ContactErrors,
  type ContactField,
  type ContactFormValues,
} from '../lib/contact-validation';

const FIELD = 'h-12 w-full rounded-xl border border-foreground/15 bg-foreground/[0.06] px-3.5 text-base text-foreground placeholder:text-foreground/35 outline-none transition-colors focus:border-cyan-300 focus:bg-foreground/[0.09] aria-[invalid=true]:border-red-400';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground/85">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-300">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-foreground/45">{hint}</p>
      ) : null}
    </div>
  );
}

export function ContactSection() {
  const [values, setValues] = React.useState<ContactFormValues>(EMPTY_CONTACT);
  const [errors, setErrors] = React.useState<ContactErrors>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const set = <K extends keyof ContactFormValues>(k: K, v: ContactFormValues[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (k in errors) setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const props = (k: ContactField) => ({
    id: `contact-${k}`,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `contact-${k}-error` : undefined,
  });

  const focusFirstError = (errs: ContactErrors) => {
    const first = (['name', 'email', 'phone', 'gymName', 'message'] as ContactField[]).find((f) => errs[f]);
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const errs = validateContact(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setBanner('Please fix the highlighted fields.');
      focusFirstError(errs);
      return;
    }
    setBanner(null);
    setSending(true);
    try {
      const result = await submitContact(values);
      if (result.ok) {
        setDone(result.message);
        setValues(EMPTY_CONTACT);
      } else if (result.kind === 'validation') {
        setErrors(result.fieldErrors);
        setBanner(result.message);
        focusFirstError(result.fieldErrors);
      } else {
        setBanner(result.message);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="relative scroll-mt-20 overflow-hidden border-t border-foreground/10 py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 size-[28rem] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHead eyebrow="Contact" title="Talk to us about your gym" body="Ask about pricing, book a demo, or tell us what you need. A person reads every message." />
          <ul className="mt-8 space-y-4 text-sm text-foreground/70">
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
              <span>We reply within one business day.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
              <span>Already a customer with a billing question? Choose Billing question and add your gym name.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-foreground/12 bg-card p-6 shadow-2xl sm:p-8">
          {done ? (
            <div role="status" className="grid place-items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-300" aria-hidden />
              <h3 className="text-xl font-bold text-foreground">Message sent</h3>
              <p className="max-w-sm text-sm text-foreground/65">{done}</p>
              <button type="button" onClick={() => setDone(null)} className="mt-2 rounded-xl border border-foreground/25 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/10">
                Send another message
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
              {banner ? (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-200 sm:col-span-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {banner}
                </p>
              ) : null}

              <Field id="contact-topic" label="What is this about?">
                <select id="contact-topic" value={values.topic} onChange={(e) => set('topic', e.target.value as ContactFormValues['topic'])} className={FIELD}>
                  {CONTACT_TOPICS.map((t) => (
                    <option key={t.value} value={t.value} className="bg-background">{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field id="contact-gymSize" label="Gym size (optional)">
                <select id="contact-gymSize" value={values.gymSize} onChange={(e) => set('gymSize', e.target.value)} className={FIELD}>
                  <option value="" className="bg-background">Choose one</option>
                  {GYM_SIZES.map((s) => (
                    <option key={s.value} value={s.value} className="bg-background">{s.label}</option>
                  ))}
                </select>
              </Field>

              <Field id="contact-name" label="Your name" error={errors.name}>
                <input {...props('name')} type="text" autoComplete="name" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Asha Verma" className={FIELD} />
              </Field>
              <Field id="contact-email" label="Email" error={errors.email}>
                <input {...props('email')} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={(e) => set('email', e.target.value)} placeholder="you@yourgym.com" className={FIELD} />
              </Field>
              <Field id="contact-phone" label="Phone (optional)" error={errors.phone} hint="So we can call if that is easier.">
                <input {...props('phone')} type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" className={FIELD} />
              </Field>
              <Field id="contact-gymName" label="Gym name (optional)" error={errors.gymName}>
                <input {...props('gymName')} type="text" autoComplete="organization" value={values.gymName} onChange={(e) => set('gymName', e.target.value)} placeholder="Iron House Fitness" className={FIELD} />
              </Field>

              <div className="sm:col-span-2">
                <Field id="contact-message" label="How can we help?" error={errors.message}>
                  <textarea
                    {...props('message')}
                    rows={5}
                    maxLength={MESSAGE_MAX + 200}
                    value={values.message}
                    onChange={(e) => set('message', e.target.value)}
                    placeholder="Tell us about your gym and what you would like to do."
                    className={`${FIELD} h-auto resize-y py-3 leading-relaxed`}
                  />
                </Field>
                <p className={`mt-1 text-right text-xs tabular-nums ${values.message.length > MESSAGE_MAX ? 'text-red-600 dark:text-red-300' : 'text-foreground/40'}`}>
                  {values.message.length}/{MESSAGE_MAX}
                </p>
              </div>

              {/* Honeypot: invisible and unreachable for people, bots fill it. */}
              <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="contact-website">Leave this empty</label>
                <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set('website', e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 px-6 text-base font-bold text-[#1a0f08] outline-none transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {sending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
