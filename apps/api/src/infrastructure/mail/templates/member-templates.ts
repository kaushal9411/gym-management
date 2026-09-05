import { detailRow, detailTable, footnote, formatMoney, infoBox, renderEmailLayout, statusBadge, toneAccent, type EmailBranding } from './base-layout';

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

/** "Email Invoice" from Member Detail — no PDF-attachment support in the mail infra, so this sends a summary with the key details rather than the PDF itself. */
export function memberInvoiceSummaryEmail(
  branding: EmailBranding,
  memberName: string,
  invoiceNumber: string,
  invoiceDate: string,
  total: string,
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE',
  dueDate: string,
  planDescription?: string | null,
) {
  const paid = status === 'PAID';
  return {
    subject: `Invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: paid ? '✅' : '🧾',
        title: paid ? 'Payment Successful!' : 'Your Invoice is Ready',
        categoryLabel: paid ? 'Payment' : 'Invoice',
        tone: paid ? 'success' : 'brand',
        preheader: paid ? `Invoice ${invoiceNumber} — paid.` : `Invoice ${invoiceNumber} — due ${dueDate}.`,
      },
      `<p>Hi ${memberName}, here's your invoice from ${branding.tenantName}.</p>
       ${detailTable(
         detailRow('👤', 'Member', memberName) +
           detailRow('📄', 'Invoice number', invoiceNumber) +
           detailRow('📅', 'Invoice date', invoiceDate) +
           (planDescription ? detailRow('🏷️', 'Membership', planDescription) : '') +
           detailRow('💰', 'Total', total, { emphasize: true }) +
           detailRow('📌', 'Status', paid ? statusBadge('Paid', 'success') : statusBadge(`Due ${dueDate}`, 'warning')),
       )}
       ${footnote('Sign in to your member portal any time to view the full details.')}`,
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
  return {
    subject: `Payment reminder — invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      { icon: '⏰', title: 'Payment Reminder', categoryLabel: 'Payment Reminder', tone: 'warning', preheader: `Invoice ${invoiceNumber} for ${total} is due ${dueDate}.` },
      `<p>Hi ${memberFirstName}, a friendly heads-up that your invoice at ${branding.tenantName} is coming due.</p>
       ${detailTable(
         detailRow('📄', 'Invoice number', invoiceNumber) +
           (planDescription ? detailRow('🏷️', 'Membership', planDescription) : '') +
           detailRow('💰', 'Amount due', total, { emphasize: true }) +
           detailRow('📅', 'Due date', dueDate),
       )}`,
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
  return {
    subject: `Outstanding balance — invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      { icon: '⚠️', title: 'Payment Required', categoryLabel: 'Past Due', tone: 'danger', preheader: `Invoice ${invoiceNumber} for ${total} is overdue (was due ${dueDate}).` },
      `<p>Hi ${memberFirstName}, your invoice at ${branding.tenantName} is now overdue. Please settle it at your earliest convenience.</p>
       ${infoBox(
         `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${
           detailRow('📄', 'Invoice number', invoiceNumber) +
           (planDescription ? detailRow('🏷️', 'Membership', planDescription) : '') +
           detailRow('💰', 'Amount due', total, { emphasize: true }) +
           detailRow('📅', 'Was due', dueDate)
         }</table>`,
         toneAccent(branding, 'danger'),
       )}`,
    ),
  };
}

/**
 * Full payment receipt sent the moment a member payment succeeds (cash/UPI/
 * card/bank transfer/cheque, or a settled online-gateway link) — the detailed
 * counterpart to the short customizable `PAYMENT_SUCCESS` in-app notice.
 * Always shows what was actually paid this transaction (`amountPaid`)
 * alongside the running total for the membership (`totalPaid`) and whatever
 * is still owed (`dueAmount`) — a gym's membership fee is very often paid in
 * installments (advance + balance), so "paid today" and "still due" are two
 * different, both-important numbers rather than one.
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
    detailRow('👤', 'Member Name', params.memberName) +
    detailRow('🧾', 'Receipt No.', params.paymentNumber) +
    detailRow('📅', 'Payment Date', params.paymentDate) +
    detailRow('💳', 'Mode of Payment', methodLabel) +
    (params.membershipPlanName ? detailRow('🏷️', 'Membership Plan', params.membershipPlanName) : '') +
    (params.membershipValidTill ? detailRow('📆', 'Valid Till', params.membershipValidTill) : '') +
    (params.transactionReference ? detailRow('🔖', 'Transaction Ref.', params.transactionReference) : '') +
    (params.discount ? detailRow('🏷️', 'Discount', `− ${money(params.discount)}`) : '') +
    (params.tax ? detailRow('➕', 'Tax', money(params.tax)) : '') +
    detailRow('💰', 'Amount Paid', money(params.amountPaid), { emphasize: true }) +
    detailRow('📊', 'Total Paid Till Date', money(params.totalPaid)) +
    detailRow(
      fullyPaid ? '✅' : '⚠️',
      'Due Amount',
      fullyPaid ? statusBadge('Fully Paid', 'success') : statusBadge(money(params.dueAmount), 'warning'),
    );

  return {
    subject: `Payment Receipt — ${params.paymentNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '✅',
        title: 'Payment Successful!',
        categoryLabel: 'Payment Receipt',
        tone: 'success',
        preheader: `We received ${money(params.amountPaid)} from ${params.memberName}.`,
      },
      `<p>Hi ${params.memberName}, thank you! We've successfully received your payment at ${branding.tenantName}. Here are your receipt details:</p>
       ${detailTable(rows)}
       ${
         fullyPaid
           ? footnote('Your membership payment is fully settled. Keep this receipt for your records.')
           : footnote(`A balance of ${money(params.dueAmount)} remains — please clear it at your earliest convenience.`)
       }`,
    ),
  };
}
