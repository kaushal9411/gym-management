import type { MemberInvoiceDetailDto } from '../dto/finance.dto';

export interface InvoiceBusinessProfile {
  legalBusinessName?: string | null;
  gstVatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export interface StampSpec {
  label: string;
  /** Border/text colour (hex) — drawn semi-transparent behind the content. */
  color: string;
  /** Solid colour for the "Status" value in the meta panel. */
  textColor: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-02` → `2 Oct 2026` (same style as the web invoice page); unparseable input is returned unchanged. */
export function formatInvoiceDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : isoDate;
}

export function sumOfSettledPayments(payments: MemberInvoiceDetailDto['payments']): number {
  return payments.filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED').reduce((sum, p) => sum + Number(p.finalAmount), 0);
}

export function remainingBalance(total: number | string, paid: number): number {
  return Math.max(Number(total) - paid, 0);
}

const STAMPS: Record<MemberInvoiceDetailDto['status'], StampSpec> = {
  PAID: { label: 'PAID', color: '#0d9467', textColor: '#0d6b4a' },
  PARTIALLY_PAID: { label: 'PARTIALLY PAID', color: '#eda100', textColor: '#9a6700' },
  UNPAID: { label: 'UNPAID', color: '#c2410c', textColor: '#c2410c' },
  OVERDUE: { label: 'OVERDUE', color: '#c2410c', textColor: '#c2410c' },
  CANCELLED: { label: 'CANCELLED', color: '#6b7090', textColor: '#6b7090' },
};

export function stampForStatus(status: MemberInvoiceDetailDto['status']): StampSpec {
  return STAMPS[status] ?? STAMPS.UNPAID;
}

export function statusLabel(status: MemberInvoiceDetailDto['status']): string {
  const label = stampForStatus(status).label;
  return label.charAt(0) + label.slice(1).toLowerCase();
}

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Address lines + contact lines under the gym name; missing parts are omitted, never rendered as blanks or "null". */
export function businessDetailLines(profile: InvoiceBusinessProfile | null): string[] {
  if (!profile) return [];
  const lines: string[] = [];
  const street = clean(profile.addressLine);
  if (street) lines.push(street);
  const cityState = [clean(profile.city), clean(profile.state)].filter(Boolean).join(', ');
  const cityLine = [cityState, clean(profile.postalCode)].filter(Boolean).join(' ');
  const full = [cityLine, clean(profile.country)].filter(Boolean).join(', ');
  if (full) lines.push(full);
  const gst = clean(profile.gstVatNumber);
  const contact = [gst ? `GSTIN ${gst}` : null, clean(profile.phone)].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  const web = [clean(profile.email), clean(profile.website)].filter(Boolean).join(' · ');
  if (web) lines.push(web);
  return lines;
}

export function businessDisplayName(profile: InvoiceBusinessProfile | null, tenantName: string): string {
  return clean(profile?.legalBusinessName) ?? tenantName;
}

/** Up to two initials from the first and last word of the name ("Kaushal Fitness Studio" → "KS"). */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return '?';
  const first = [...words[0]!][0]!;
  const last = words.length > 1 ? [...words[words.length - 1]!][0]! : ([...words[0]!][1] ?? '');
  return (first + last).toUpperCase();
}

/**
 * Assigns each row (by height) to a page. The first page has `firstCapacity`
 * points available, later pages `nextCapacity`. A row never splits; a row
 * taller than a whole page still gets a page of its own.
 */
export function paginateRows(heights: number[], firstCapacity: number, nextCapacity: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  let capacity = firstCapacity;
  heights.forEach((h, i) => {
    const page = pages[pages.length - 1]!;
    if (page.length > 0 && used + h > capacity) {
      pages.push([]);
      used = 0;
      capacity = nextCapacity;
    }
    pages[pages.length - 1]!.push(i);
    used += h;
  });
  return pages;
}
