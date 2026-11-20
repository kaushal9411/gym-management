import {
  ClipboardCheck,
  CreditCard,
  FileText,
  Percent,
  Receipt,
  RefreshCcw,
  type LucideIcon,
} from 'lucide-react';

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#analytics', label: 'Analytics' },
  { href: '#billing', label: 'Billing' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
] as const;

export interface BillingItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const BILLING_FEATURES: BillingItem[] = [
  { icon: Receipt, title: 'Invoices and receipts', body: 'Every sale gets a numbered invoice and receipt your members can download as a PDF.' },
  { icon: CreditCard, title: 'Online payments', body: 'Collect payments online through Razorpay, or send a payment link by email or SMS.' },
  { icon: Percent, title: 'GST and discounts', body: 'Set tax rates and discounts once. Plans, invoices and reports use them everywhere.' },
  { icon: RefreshCcw, title: 'Renewals that follow up', body: 'Renewal invoices are created before a plan ends, and members get reminders until they pay.' },
  { icon: ClipboardCheck, title: 'Cash, refunds and part-payments', body: 'Record desk payments, take part-payments against an invoice, and refund with a reason.' },
  { icon: FileText, title: 'Income and expenses', body: 'Track what comes in and what goes out, then see profit by branch and by month.' },
];

export const STEPS = [
  { title: 'Register your gym', body: 'Choose a plan, pick your gym address and verify your email. Your gym is set up automatically.' },
  { title: 'Add your plans and members', body: 'Create membership plans, then add members one by one or import your existing list from a spreadsheet.' },
  { title: 'Get paid and stay in touch', body: 'Collect payments, track attendance, and message members when plans are due or classes change.' },
] as const;

export const FAQ_ITEMS = [
  {
    q: 'How do I get started?',
    a: 'Press Register, choose a plan and follow the steps. Your gym gets its own address and a login for the owner as soon as your email is verified.',
  },
  {
    q: 'Do my members and trainers get an app?',
    a: 'Yes. Members, trainers, receptionists, managers and owners each get an Android app, and members can also use the web portal.',
  },
  {
    q: 'Can I run more than one branch?',
    a: 'Yes. The number of branches depends on your plan. Staff can be limited to the branches they work in.',
  },
  {
    q: 'How do members pay?',
    a: 'At the desk in cash, or online through Razorpay. You can also send a payment link by email or SMS. Every payment is matched to an invoice.',
  },
  {
    q: 'Can I message members about offers and renewals?',
    a: 'Yes. Pick members by filter or by hand and send by push, email, SMS or WhatsApp. Reminders for expiring plans, overdue payments and classes can also run automatically. SMS and WhatsApp need your own sender registration with the provider.',
  },
  {
    q: 'What happens to my data if I leave?',
    a: 'Your gym data stays separate from other gyms. Reports and member lists can be exported at any time as PDF, Excel or CSV.',
  },
  {
    q: 'I already have an account. Where do I sign in?',
    a: 'Press Login in the top corner and choose your gym.',
  },
] as const;
