import PDFDocument from 'pdfkit';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { InvoiceRepository, type InvoiceLineInput } from '../repositories/invoice.repository';

export interface GenerateInvoiceInput {
  tenantId: string;
  subscriptionId: string | null;
  couponId: string | null;
  lineItems: InvoiceLineInput[];
  taxAmount: number;
  discountAmount: number;
  currency: string;
  dueDate?: Date | null;
}

export class InvoiceService {
  private readonly invoiceRepository: InvoiceRepository;

  constructor(db: TenantScopedPrisma) {
    this.invoiceRepository = new InvoiceRepository(db);
  }

  async generate(input: GenerateInvoiceInput) {
    const subtotal = input.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const total = Math.max(subtotal - input.discountAmount + input.taxAmount, 0);
    const invoiceNumber = await this.invoiceRepository.nextInvoiceNumber();

    return this.invoiceRepository.create({
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      couponId: input.couponId,
      invoiceNumber,
      subtotal,
      taxAmount: input.taxAmount,
      discountAmount: input.discountAmount,
      total,
      currency: input.currency,
      dueDate: input.dueDate ?? null,
      items: input.lineItems,
    });
  }

  async list(tenantId: string) {
    return this.invoiceRepository.listForTenant(tenantId);
  }

  async markPaid(invoiceId: string) {
    return this.invoiceRepository.markPaid(invoiceId);
  }

  /**
   * Renders a printable HTML document — the "Invoice Download" deliverable.
   * Deliberately HTML, not a binary PDF: generating real PDFs needs a
   * rendering engine (puppeteer/pdfkit) with no equivalent already in this
   * codebase, and every browser can already save/print HTML to PDF. Swapping
   * in a PDF renderer later only touches this one method.
   */
  async renderDownload(tenantId: string, invoiceId: string, tenantName: string): Promise<string> {
    const invoice = await this.invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) throw new AppError(ErrorCode.NOT_FOUND, 'Invoice not found.', 404);

    const money = (amount: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(amount);

    const rows = invoice.items
      .map(
        (item) => `<tr>
          <td style="padding:8px 0;">${item.description}</td>
          <td style="padding:8px 0;text-align:right;">${item.quantity}</td>
          <td style="padding:8px 0;text-align:right;">${money(Number(item.unitPrice))}</td>
          <td style="padding:8px 0;text-align:right;">${money(Number(item.amount))}</td>
        </tr>`,
      )
      .join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${invoice.invoiceNumber}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#111;">
  <h1 style="font-size:20px;">Invoice ${invoice.invoiceNumber}</h1>
  <p style="color:#6b7280;">Billed to: ${tenantName}<br/>Issued: ${invoice.createdAt.toDateString()}<br/>Status: ${invoice.status}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:24px;">
    <thead><tr style="border-bottom:1px solid #e5e7eb;text-align:left;">
      <th style="padding:8px 0;">Description</th><th style="text-align:right;">Qty</th>
      <th style="text-align:right;">Unit price</th><th style="text-align:right;">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:16px;text-align:right;">
    <p>Subtotal: ${money(Number(invoice.subtotal))}</p>
    <p>Discount: -${money(Number(invoice.discountAmount))}</p>
    <p>Tax: ${money(Number(invoice.taxAmount))}</p>
    <p style="font-weight:700;font-size:16px;">Total: ${money(Number(invoice.total))}</p>
  </div>
</body></html>`;
  }

  /** Real binary PDF via pdfkit (already a dependency, used by the unrelated Member Invoice module) — same layout, adapted to this model's fields. */
  async renderPdf(tenantId: string, invoiceId: string, tenantName: string): Promise<Buffer> {
    const invoice = await this.invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) throw new AppError(ErrorCode.NOT_FOUND, 'Invoice not found.', 404);

    const money = (amount: number | string | { toString(): string }) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(amount.toString()));

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(`Invoice ${invoice.invoiceNumber}`, { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Billed to: ${tenantName}`);
      doc.text(`Issued: ${invoice.createdAt.toDateString()}${invoice.dueDate ? `    Due: ${invoice.dueDate.toDateString()}` : ''}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown();
      doc.fillColor('#111827');

      const tableTop = doc.y;
      doc.fontSize(10).text('Description', 50, tableTop, { width: 260 });
      doc.text('Qty', 320, tableTop, { width: 50, align: 'right' });
      doc.text('Unit price', 370, tableTop, { width: 80, align: 'right' });
      doc.text('Amount', 460, tableTop, { width: 80, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).stroke();

      let y = tableTop + 22;
      for (const item of invoice.items) {
        doc.text(item.description, 50, y, { width: 260 });
        doc.text(String(item.quantity), 320, y, { width: 50, align: 'right' });
        doc.text(money(item.unitPrice), 370, y, { width: 80, align: 'right' });
        doc.text(money(item.amount), 460, y, { width: 80, align: 'right' });
        y += 20;
      }

      y += 10;
      doc.text(`Subtotal: ${money(invoice.subtotal)}`, 370, y, { width: 170, align: 'right' });
      y += 16;
      doc.text(`Discount: -${money(invoice.discountAmount)}`, 370, y, { width: 170, align: 'right' });
      y += 16;
      doc.text(`Tax: ${money(invoice.taxAmount)}`, 370, y, { width: 170, align: 'right' });
      y += 20;
      doc.fontSize(12).text(`Total: ${money(invoice.total)}`, 370, y, { width: 170, align: 'right' });

      doc.end();
    });
  }
}
