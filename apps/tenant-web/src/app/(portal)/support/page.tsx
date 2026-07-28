'use client';

import { HelpCircle, LifeBuoy, Mail, MessageSquareText } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useTenant } from '@/features/tenant/tenant-provider';

const FAQS = [
  { question: 'How do I invite a staff member?', answer: 'Staff invitations are managed from the Staff module once it ships.' },
  { question: 'How do I change my subscription plan?', answer: 'Go to Billing → Overview and choose "Change plan".' },
  { question: 'Can I add another branch?', answer: 'Branch management is coming with the Branches module.' },
];

/** Help Center foundation: FAQs + contact info + a placeholder for the future ticketing system. */
export default function SupportPage() {
  const tenant = useTenant();
  const hasTickets = tenant.featureFlags.includes('support_tickets');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <LifeBuoy className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Help Center</h1>
          <p className="text-muted-foreground">Find answers or reach the FitCloud team.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
            Frequently asked questions
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-3.5 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{faq.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support tickets</CardTitle>
          <CardDescription>Track and raise issues directly with our team.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasTickets ? (
            <EmptyState icon={MessageSquareText} title="No tickets yet" description="Your plan includes support tickets — this module is coming soon." />
          ) : (
            <EmptyState icon={LifeBuoy} title="Not on your plan" description="Upgrade your subscription to unlock support tickets." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact us</CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href="mailto:support@fitcloud.com"
            className="inline-flex items-center gap-2.5 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Mail className="size-3.5" aria-hidden />
            </span>
            support@fitcloud.com
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
