'use client';

import { LifeBuoy, Mail, MessageSquareText } from 'lucide-react';

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">Find answers or reach the FitCloud team.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <p className="text-sm font-medium">{faq.question}</p>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
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
          <a href="mailto:support@fitcloud.com" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Mail className="size-4" />
            support@fitcloud.com
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
