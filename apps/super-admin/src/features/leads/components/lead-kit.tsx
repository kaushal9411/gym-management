'use client';

/** Labels, tones and small shared pieces for the Leads pages. */
import { Chip, type ChipTone } from '@/features/dashboard/components/ui';
import type { LeadStatus, LeadTopic } from '../types';

export const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];
export const LEAD_TOPICS: LeadTopic[] = ['SALES', 'DEMO', 'BILLING', 'GENERAL'];

export const STATUS_LABEL: Record<LeadStatus, string> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', WON: 'Won', LOST: 'Lost' };
export const TOPIC_LABEL: Record<LeadTopic, string> = { SALES: 'Sales', DEMO: 'Demo request', BILLING: 'Billing', GENERAL: 'General' };
const STATUS_TONE: Record<LeadStatus, ChipTone> = { NEW: 'blue', CONTACTED: 'amber', QUALIFIED: 'violet', WON: 'green', LOST: 'slate' };
const TOPIC_TONE: Record<LeadTopic, ChipTone> = { SALES: 'violet', DEMO: 'blue', BILLING: 'amber', GENERAL: 'slate' };

export const SIZE_LABEL: Record<string, string> = {
  'under-100': 'Under 100 members',
  '100-300': '100 to 300 members',
  '300-1000': '300 to 1,000 members',
  'over-1000': 'Over 1,000 members',
};

export const SOURCE_LABEL: Record<string, string> = { HOME_PAGE: 'Website home page', STATUS_SCREEN: 'Trial / billing screen' };

export const LeadStatusChip = ({ status }: { status: LeadStatus }) => <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
export const LeadTopicChip = ({ topic }: { topic: LeadTopic }) => <Chip tone={TOPIC_TONE[topic]}>{TOPIC_LABEL[topic]}</Chip>;

export const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: 'var(--chart-2)',
  CONTACTED: 'var(--chart-4)',
  QUALIFIED: 'var(--chart-3)',
  WON: 'var(--chart-6)',
  LOST: 'var(--chart-7)',
};
