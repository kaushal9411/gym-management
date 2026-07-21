'use client';

import * as React from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/features/auth/services/api-client';
import { useTenant } from '@/features/tenant/tenant-provider';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

const textareaClassName = cn(
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

interface ContactSalesDialogProps {
  topic: 'sales' | 'billing';
  triggerLabel: string;
  /** Match the surrounding StatusScreen buttons. */
  triggerVariant?: 'default' | 'outline';
}

/**
 * In-app replacement for the old mailto: links (which silently do nothing
 * on machines without a mail client). Submits to the public
 * /public/contact endpoint — works signed-in or signed-out.
 */
export function ContactSalesDialog({ topic, triggerLabel, triggerVariant = 'outline' }: ContactSalesDialogProps) {
  const tenant = useTenant();
  const user = useAppSelector((state) => state.auth.user);

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Late store hydration (redux-persist) — refresh the prefill once known.
  React.useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setEmail((current) => current || user.email);
    }
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/public/contact', {
        topic,
        name,
        email,
        gymSlug: tenant.id === 'platform' ? undefined : tenant.slug,
        message,
      });
      toast.success("Message sent — we'll get back to you within one business day.");
      setOpen(false);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="w-full sm:w-auto">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{topic === 'sales' ? 'Talk to sales' : 'Contact billing'}</DialogTitle>
          <DialogDescription>
            Tell us how to reach you — the {topic} team replies within one business day.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Your name</Label>
              <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <textarea
              id="contact-message"
              className={textareaClassName}
              placeholder={
                topic === 'sales'
                  ? 'e.g. Our trial ended — we want to discuss plans and pricing for our gym.'
                  : 'e.g. Our subscription lapsed and we need help renewing.'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || message.trim().length < 10}>
            <Send className="size-4" />
            {submitting ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
