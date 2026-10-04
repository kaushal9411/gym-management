import {
  alertBox,
  detailRow,
  detailTable,
  escapeHtml,
  footnote,
  formatDate,
  formatMoney,
  keyFacts,
  paragraph,
  renderEmailLayout,
  sectionTitle,
  signature,
  statusBadge,
  stepList,
  strong,
  toneAccent,
  type EmailBranding,
} from './base-layout';

/** Human-readable labels for `MemberPaymentMethod` — CASH/UPI/CREDIT_CARD/DEBIT_CARD/BANK_TRANSFER/CHEQUE/ONLINE_GATEWAY. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ONLINE_GATEWAY: 'Online Payment',
};

export interface InvoiceLineItem {
  description: string;
  quantity: number | string;
  /** Pre-formatted amount (e.g. "₹1,500.00"). */
  amount: string;
}

/** Itemised lines card: description (× qty) and amount per row. */
function lineItemsTable(items: InvoiceLineItem[]): string {
  const rows = items.map((it) => detailRow('', `${it.description}${Number(it.quantity) > 1 ? ` × ${it.quantity}` : ''}`, escapeHtml(it.amount))).join('');
  return detailTable(rows);
}

const PAY_HINT = (tenant: string) => `You can pay at the front desk of ${tenant}, or ask the team there about other payment options.`;

/** "Email Invoice" from Member Detail — no PDF attachment support, so this sends an itemised summary. */
export function memberInvoiceSummaryEmail(
  branding: EmailBranding,
  memberName: string,
  invoiceNumber: string,
  invoiceDate: string,
  total: string,
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE',
  dueDate: string,
  planDescription?: string | null,
  opts?: { lineItems?: InvoiceLineItem[] },
) {
  const paid = status === 'PAID';
  const overdue = status === 'OVERDUE';
  const statusLabel = paid ? 'Paid' : overdue ? 'Overdue' : status === 'PARTIALLY_PAID' ? 'Partially paid' : 'Unpaid';
  const tone = paid ? 'success' : overdue ? 'danger' : 'warning';
  const due = formatDate(dueDate);
  return {
    subject: `Invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: paid ? '✅' : '🧾',
        title: paid ? 'Invoice paid' : 'Your invoice is ready',
        subtitle: `Invoice ${invoiceNumber} from ${branding.tenantName}`,
        categoryLabel: 'Invoice',
        tone: paid ? 'success' : overdue ? 'danger' : 'brand',
        preheader: paid ? `Invoice ${invoiceNumber} — paid.` : `Invoice ${invoiceNumber} — due ${due}.`,
        footerHint: 'preferences',
      },
      `${paragraph(`Hi ${escapeHtml(memberName)}, here’s your invoice from ${strong(branding.tenantName)}.`)}
       ${keyFacts([
         { icon: '💰', label: 'Total', value: total },
         { icon: '📌', label: 'Status', value: statusLabel, color: paid ? '#15803d' : overdue ? '#dc2626' : '#b45309' },
         { icon: '📅', label: paid ? 'Due date' : 'Pay by', value: due },
       ])}
       ${opts?.lineItems?.length ? `${sectionTitle('Items')}${lineItemsTable(opts.lineItems)}` : ''}
       ${sectionTitle('Invoice details')}
       ${detailTable(
         detailRow('👤', 'Member', escapeHtml(memberName)) +
           detailRow('📄', 'Invoice number', escapeHtml(invoiceNumber)) +
           detailRow('🗓️', 'Invoice date', escapeHtml(formatDate(invoiceDate))) +
           (planDescription ? detailRow('🏷️', 'Membership', escapeHtml(planDescription)) : '') +
           detailRow('💰', 'Total', escapeHtml(total), { emphasize: true, color: toneAccent(branding, paid ? 'success' : 'brand') }) +
           detailRow('📌', 'Status', statusBadge(paid ? 'Paid' : `${statusLabel} · due ${due}`, tone)),
       )}
       ${paid ? alertBox('success', 'Nothing to pay', 'This invoice is settled. Keep this email for your records.') : alertBox('info', 'How to pay', escapeHtml(PAY_HINT(branding.tenantName)))}
       ${paid ? '' : `${sectionTitle('What happens next')}${stepList([{ title: `Pay ${total} by ${due}`, body: 'At the front desk, or via any payment option the gym offers.' }, { title: 'You’ll receive a receipt by email', body: 'It is sent as soon as the payment is recorded.' }])}`}
       ${signature(branding)}
       ${footnote('You can also view your invoices any time in your member portal.')}`,
    ),
  };
}

export function paymentDueReminderEmail(
  branding: EmailBranding,
  memberFirstName: string,
  invoiceNumber: string,
  total: string,
  dueDate: string,
  planDescription?: string | null,
) {
  const due = formatDate(dueDate);
  return {
    subject: `Payment reminder — invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '⏰',
        title: 'Payment reminder',
        subtitle: `${total} due on ${due}`,
        categoryLabel: 'Payment Reminder',
        tone: 'warning',
        preheader: `Invoice ${invoiceNumber} for ${total} is due ${due}.`,
        footerHint: 'preferences',
      },
      `${paragraph(`Hi ${escapeHtml(memberFirstName)}, a friendly heads-up that your invoice at ${strong(branding.tenantName)} is coming due.`)}
       ${keyFacts([
         { icon: '💰', label: 'Amount due', value: total, color: '#b45309' },
         { icon: '📅', label: 'Due date', value: due },
       ])}
       ${detailTable(
         detailRow('📄', 'Invoice number', escapeHtml(invoiceNumber)) +
           (planDescription ? detailRow('🏷️', 'Membership', escapeHtml(planDescription)) : '') +
           detailRow('📌', 'Status', statusBadge('Upcoming', 'warning')),
       )}
       ${alertBox('info', 'How to pay', escapeHtml(PAY_HINT(branding.tenantName)))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: `Pay ${total} by ${due}`, body: 'At the front desk, or via any payment option the gym offers.' }, { title: 'You’ll receive a receipt by email', body: 'It is sent as soon as the payment is recorded.' }])}
       ${signature(branding)}
       ${footnote('Already paid? Thank you — please ignore this reminder.')}`,
    ),
  };
}

export function paymentOverdueReminderEmail(
  branding: EmailBranding,
  memberFirstName: string,
  invoiceNumber: string,
  total: string,
  dueDate: string,
  planDescription?: string | null,
) {
  const due = formatDate(dueDate);
  return {
    subject: `Outstanding balance — invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '⚠️',
        title: 'Payment required',
        subtitle: `${total} was due on ${due}`,
        categoryLabel: 'Past Due',
        tone: 'danger',
        preheader: `Invoice ${invoiceNumber} for ${total} is overdue (was due ${due}).`,
        footerHint: 'preferences',
      },
      `${paragraph(`Hi ${escapeHtml(memberFirstName)}, your invoice at ${strong(branding.tenantName)} is now overdue. Please settle it at your earliest convenience so your membership isn’t interrupted.`)}
       ${keyFacts([
         { icon: '💰', label: 'Outstanding', value: total, color: '#dc2626' },
         { icon: '📅', label: 'Was due', value: due },
       ])}
       ${detailTable(
         detailRow('📄', 'Invoice number', escapeHtml(invoiceNumber)) +
           (planDescription ? detailRow('🏷️', 'Membership', escapeHtml(planDescription)) : '') +
           detailRow('📌', 'Status', statusBadge('Overdue', 'danger')),
       )}
       ${alertBox('danger', 'Please pay soon', escapeHtml(PAY_HINT(branding.tenantName)))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: `Pay ${total} at your earliest convenience`, body: 'At the front desk, or via any payment option the gym offers.' }, { title: 'You’ll receive a receipt by email', body: 'It is sent as soon as the payment is recorded.' }, { title: 'Already paid or something looks wrong?', body: 'Tell the gym and they will check the invoice.' }])}
       ${signature(branding)}
       ${footnote('Already paid? Thank you — please ignore this reminder; it may have crossed with your payment.')}`,
    ),
  };
}

/**
 * Full payment receipt sent the moment a member payment succeeds. Shows what was paid this transaction
 * (`amountPaid`) alongside the running total (`totalPaid`) and whatever is still owed (`dueAmount`) — gym fees
 * are often paid in instalments, so "paid today" and "still due" are two different, both-important numbers.
 */
export function memberPaymentReceiptEmail(
  branding: EmailBranding,
  params: {
    memberName: string;
    paymentNumber: string;
    paymentDate: string;
    method: string;
    currencySymbol: string;
    amountPaid: number;
    discount?: number;
    tax?: number;
    totalPaid: number;
    dueAmount: number;
    membershipPlanName?: string | null;
    membershipValidTill?: string | null;
    transactionReference?: string | null;
  },
) {
  const money = (amount: number) => formatMoney(amount, params.currencySymbol);
  const methodLabel = PAYMENT_METHOD_LABEL[params.method] ?? params.method;
  const fullyPaid = params.dueAmount <= 0;

  const rows =
    detailRow('👤', 'Member name', escapeHtml(params.memberName)) +
    detailRow('🧾', 'Receipt no.', escapeHtml(params.paymentNumber)) +
    detailRow('📅', 'Payment date', escapeHtml(formatDate(params.paymentDate))) +
    detailRow('💳', 'Mode of payment', escapeHtml(methodLabel)) +
    (params.membershipPlanName ? detailRow('🏷️', 'Membership plan', escapeHtml(params.membershipPlanName)) : '') +
    (params.membershipValidTill ? detailRow('📆', 'Valid till', escapeHtml(formatDate(params.membershipValidTill))) : '') +
    (params.transactionReference ? detailRow('🔖', 'Transaction ref.', escapeHtml(params.transactionReference)) : '') +
    (params.discount ? detailRow('🎟️', 'Discount', `− ${escapeHtml(money(params.discount))}`) : '') +
    (params.tax ? detailRow('➕', 'Tax', escapeHtml(money(params.tax))) : '') +
    detailRow('💰', 'Amount paid', escapeHtml(money(params.amountPaid)), { emphasize: true, color: toneAccent(branding, 'success') }) +
    detailRow('📊', 'Total paid to date', escapeHtml(money(params.totalPaid))) +
    detailRow('📌', 'Balance', fullyPaid ? statusBadge('Fully paid', 'success') : statusBadge(money(params.dueAmount), 'warning'));

  return {
    subject: `Payment Receipt — ${params.paymentNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '✅',
        title: 'Payment received',
        subtitle: `${money(params.amountPaid)} · receipt ${params.paymentNumber}`,
        categoryLabel: 'Payment Receipt',
        tone: 'success',
        preheader: `We received ${money(params.amountPaid)} from ${params.memberName}.`,
        footerHint: 'preferences',
      },
      `${paragraph(`Hi ${escapeHtml(params.memberName)}, thank you! ${strong(branding.tenantName)} has successfully received your payment.`)}
       ${keyFacts([
         { icon: '💰', label: 'Paid today', value: money(params.amountPaid), color: '#15803d' },
         { icon: '📊', label: fullyPaid ? 'Status' : 'Balance due', value: fullyPaid ? 'Fully paid' : money(params.dueAmount), color: fullyPaid ? '#15803d' : '#b45309' },
       ])}
       ${sectionTitle('Receipt details')}
       ${detailTable(rows)}
       ${fullyPaid ? alertBox('success', 'All settled', 'Your membership payment is fully paid. Keep this receipt for your records.') : alertBox('warning', `Balance of ${money(params.dueAmount)} remains`, escapeHtml(PAY_HINT(branding.tenantName)))}
       ${sectionTitle('What happens next')}
       ${stepList(fullyPaid ? [{ title: 'Nothing more to pay', body: 'Your membership payment is settled.' }, { title: 'Keep this email as your receipt' }] : [{ title: `Pay the remaining ${money(params.dueAmount)}`, body: 'At the front desk, or via any payment option the gym offers.' }, { title: 'A new receipt is emailed after each payment' }])}
       ${signature(branding, 'Thank you,')}`,
    ),
  };
}
