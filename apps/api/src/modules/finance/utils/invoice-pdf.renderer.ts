import PDFDocument from 'pdfkit';

import { PDF_FONT_BOLD, PDF_FONT_REGULAR } from '../../../core/pdf/pdf-fonts';
import { formatMoney } from '../../../infrastructure/mail/templates/base-layout';
import type { MemberInvoiceDetailDto } from '../dto/finance.dto';

import {
  businessDetailLines,
  businessDisplayName,
  formatInvoiceDate,
  initialsOf,
  paginateRows,
  remainingBalance,
  stampForStatus,
  statusLabel,
  sumOfSettledPayments,
  type InvoiceBusinessProfile,
} from './invoice-pdf.helpers';

export interface InvoicePdfInput {
  invoice: MemberInvoiceDetailDto;
  tenantName: string;
  profile: InvoiceBusinessProfile | null;
  /** PNG/JPEG bytes, already validated; `null` → initials tile. */
  logo: Buffer | null;
  footerText: string | null;
  currencySymbol: string;
}

type Doc = InstanceType<typeof PDFDocument>;

const px = (n: number) => n * 0.75;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = px(56);
const CW = PAGE_W - MX * 2;
const FOOTER_RULE_Y = PAGE_H - px(34) - px(14) - 22;
const CONTENT_BOTTOM = FOOTER_RULE_Y - px(18);
const CONT_TOP = px(10) + px(36);
const GAP = px(28);

const INDIGO = '#4338ca';
const INK = '#171a2e';
const MUTED = '#6b7090';
const BODY = '#4a4f70';
const LINE = '#eceef7';
const GREEN = '#0d6b4a';
const ORANGE = '#c2410c';
const FALLBACK_FOOTER = 'Thank you for your business. This is a computer-generated invoice.';

const BOLD = 'bold';
const REG = 'regular';

function gradient(doc: Doc, x: number, y: number, w: number, h: number, angled = false) {
  const g = angled ? doc.linearGradient(x, y, x + w, y + h * 0.4) : doc.linearGradient(x, y, x + w, y);
  return g.stop(0, '#4338ca').stop(0.62, '#7c3aed').stop(1, '#c026d3');
}

function label(doc: Doc, text: string, x: number, y: number, width?: number) {
  doc.font(BOLD).fontSize(px(9)).fillColor(MUTED).text(text.toUpperCase(), x, y, { width, characterSpacing: 0.7, lineBreak: false });
}

function drawPageChrome(doc: Doc, invoice: MemberInvoiceDetailDto): void {
  doc.rect(0, 0, PAGE_W, px(10)).fill(gradient(doc, 0, 0, PAGE_W, px(10)));

  const stamp = stampForStatus(invoice.status);
  const fontSize = px(26);
  doc.font(BOLD).fontSize(fontSize);
  const spacing = fontSize * 0.12;
  const textW = doc.widthOfString(stamp.label, { characterSpacing: spacing });
  const boxW = textW + px(36) + 2;
  const boxH = fontSize * 1.17 + px(12) + 2;
  const right = PAGE_W - px(56);
  const x = right - boxW;
  const y = px(650);
  doc.save();
  doc.rotate(-14, { origin: [x + boxW / 2, y + boxH / 2] });
  doc.fillOpacity(0.55).strokeOpacity(0.55);
  doc.lineWidth(px(3)).roundedRect(x, y, boxW, boxH, px(10)).stroke(stamp.color);
  doc.fillColor(stamp.color).text(stamp.label, x + px(18) + 1, y + px(6) + 1, {
    characterSpacing: spacing,
    lineBreak: false,
  });
  doc.restore();
}

function drawLogoOrTile(doc: Doc, logo: Buffer | null, name: string, x: number, y: number): void {
  const size = px(54);
  if (logo) {
    try {
      doc.save();
      doc.roundedRect(x, y, size, size, px(14)).clip();
      doc.image(logo, x, y, { fit: [size, size], align: 'center', valign: 'center' });
      doc.restore();
      return;
    } catch {
      doc.restore();
      /* unreadable image — use the initials tile */
    }
  }
  doc.roundedRect(x, y, size, size, px(14)).fill(
    doc
      .linearGradient(x, y, x + size, y + size)
      .stop(0, '#4338ca')
      .stop(1, '#c026d3'),
  );
  doc.font(BOLD).fontSize(px(20)).fillColor('#ffffff');
  const initials = initialsOf(name);
  doc.text(initials, x, y + size / 2 - px(20) * 0.58, {
    width: size,
    align: 'center',
    lineBreak: false,
  });
}

function textHeight(doc: Doc, text: string, font: string, size: number, width: number, lineGap = 0): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width, lineGap });
}

function drawHeader(doc: Doc, input: InvoicePdfInput): number {
  const { invoice } = input;
  const top = px(10) + px(30);
  const name = businessDisplayName(input.profile, input.tenantName);
  const tile = px(54);
  const textX = MX + tile + px(14);
  const rightW = px(190);
  const leftW = CW - tile - px(14) - rightW - px(24);

  drawLogoOrTile(doc, input.logo, name, MX, top);

  const lineGap = px(11) * 0.4;
  doc.font(BOLD).fontSize(px(16)).fillColor(INK);
  const nameH = doc.heightOfString(name, { width: leftW });
  doc.text(name, textX, top, { width: leftW });
  const details = businessDetailLines(input.profile).join('\n');
  let leftBottom = top + nameH;
  if (details) {
    doc.font(REG).fontSize(px(11)).fillColor(BODY);
    const dy = top + nameH + px(2);
    doc.text(details, textX, dy, { width: leftW, lineGap });
    leftBottom = dy + doc.heightOfString(details, { width: leftW, lineGap });
  }

  doc
    .font(BOLD)
    .fontSize(px(30))
    .fillColor(INDIGO)
    .text('INVOICE', PAGE_W - MX - rightW, top - 2, {
      width: rightW,
      align: 'right',
      lineBreak: false,
    });
  doc
    .font(BOLD)
    .fontSize(px(14))
    .fillColor(INK)
    .text(invoice.invoiceNumber, PAGE_W - MX - rightW, top + px(30) * 1.2 + px(2), {
      width: rightW,
      align: 'right',
      lineBreak: false,
    });

  return Math.max(leftBottom, top + tile) + GAP;
}

function drawMeta(doc: Doc, input: InvoicePdfInput, y: number): number {
  const { invoice } = input;
  const pad = px(20);
  const gap = px(18);
  const inner = CW - pad * 2 - gap * 3;
  const fr = inner / 4.3;
  const widths = [fr * 1.3, fr, fr, fr];
  const xs: number[] = [];
  let cx = MX + pad;
  widths.forEach((w) => {
    xs.push(cx);
    cx += w + gap;
  });

  const sub = `${invoice.member.memberId} · ${invoice.branch.name}`;
  const nameH = textHeight(doc, invoice.member.name, BOLD, px(13), widths[0]!);
  const subH = textHeight(doc, sub, BOLD, px(11), widths[0]!);
  const labelH = px(9) * 1.2;
  const contentH = labelH + px(5) + nameH + px(2) + subH;
  const h = pad * 0.9 * 2 + contentH;

  doc.roundedRect(MX, y, CW, h, px(14)).fill('#f6f6fd');
  const ty = y + pad * 0.9;
  const vy = ty + labelH + px(5);

  label(doc, 'Billed to', xs[0]!, ty);
  doc.font(BOLD).fontSize(px(13)).fillColor(INK).text(invoice.member.name, xs[0]!, vy, { width: widths[0]! });
  doc
    .font(BOLD)
    .fontSize(px(11))
    .fillColor(MUTED)
    .text(sub, xs[0]!, vy + nameH + px(2), { width: widths[0]! });

  label(doc, 'Invoice date', xs[1]!, ty);
  doc.font(BOLD).fontSize(px(13)).fillColor(INK).text(formatInvoiceDate(invoice.invoiceDate), xs[1]!, vy, {
    width: widths[1]!,
    lineBreak: false,
  });
  label(doc, 'Due date', xs[2]!, ty);
  doc.font(BOLD).fontSize(px(13)).fillColor(INK).text(formatInvoiceDate(invoice.dueDate), xs[2]!, vy, { width: widths[2]!, lineBreak: false });
  label(doc, 'Status', xs[3]!, ty);
  doc.font(BOLD).fontSize(px(13)).fillColor(stampForStatus(invoice.status).textColor).text(statusLabel(invoice.status), xs[3]!, vy, { width: widths[3]!, lineBreak: false });

  return y + h + GAP;
}

const COL_QTY = 50;
const COL_UNIT = 90;
const COL_DESC = CW * 0.52;
const COL_AMT = CW - COL_DESC - COL_QTY - COL_UNIT;
const CELL_PAD_X = px(12);
const HEAD_H = px(9) * 1.2 + px(9) * 2;

function drawTableHeader(doc: Doc, y: number): number {
  doc.roundedRect(MX, y, CW, HEAD_H, px(10)).fill(INDIGO);
  doc.rect(MX, y + HEAD_H / 2, CW, HEAD_H / 2).fill(INDIGO);
  const ty = y + px(9);
  const cs = 0.6;
  doc.font(BOLD).fontSize(px(9)).fillColor('#ffffff');
  doc.text('DESCRIPTION', MX + CELL_PAD_X, ty, { characterSpacing: cs, lineBreak: false });
  doc.text('QTY', MX + COL_DESC, ty, {
    width: COL_QTY,
    align: 'right',
    characterSpacing: cs,
    lineBreak: false,
  });
  doc.text('UNIT PRICE', MX + COL_DESC + COL_QTY, ty, {
    width: COL_UNIT,
    align: 'right',
    characterSpacing: cs,
    lineBreak: false,
  });
  doc.text('AMOUNT', MX + COL_DESC + COL_QTY + COL_UNIT, ty, {
    width: COL_AMT - CELL_PAD_X,
    align: 'right',
    characterSpacing: cs,
    lineBreak: false,
  });
  return y + HEAD_H;
}

function totalsHeight(showPaid: boolean, showBalance: boolean): number {
  const row = px(12) * 1.2 + px(12);
  let h = row * 3 + px(6) + px(12) * 2 + px(19) * 1.2;
  if (showPaid) h += px(8) + row;
  if (showBalance) h += px(2) + px(11) * 2 + px(17) * 1.2 + 4;
  return h;
}

function drawTotals(doc: Doc, input: InvoicePdfInput, x: number, y: number, w: number): void {
  const { invoice, currencySymbol } = input;
  const money = (n: number | string) => formatMoney(Number(n), currencySymbol);
  const paid = sumOfSettledPayments(invoice.payments);
  const row = px(12) * 1.2 + px(12);
  const pad = px(6);
  const line = (text: string, value: string, ly: number, valueColor = '#3a3f60', rule = false) => {
    if (rule)
      doc
        .moveTo(x, ly)
        .lineTo(x + w, ly)
        .lineWidth(0.75)
        .stroke(LINE);
    doc
      .font(BOLD)
      .fontSize(px(12))
      .fillColor('#3a3f60')
      .text(text, x, ly + pad, { width: w, lineBreak: false });
    doc.fillColor(valueColor).text(value, x, ly + pad, { width: w, align: 'right', lineBreak: false });
  };

  let cy = y;
  line('Subtotal', money(invoice.subtotal), cy);
  cy += row;
  line('Discount', `− ${money(invoice.discountAmount)}`, cy, GREEN, true);
  cy += row;
  line('Tax', money(invoice.taxAmount), cy, '#3a3f60', true);
  cy += row + px(6);

  const barH = px(12) * 2 + px(19) * 1.2;
  doc.roundedRect(x, cy, w, barH, px(10)).fill(gradient(doc, x, cy, w, barH, true));
  doc
    .font(BOLD)
    .fontSize(px(12))
    .fillColor('#ffffff')
    .text('Total', x + px(14), cy + barH / 2 - px(12) * 0.6, { lineBreak: false });
  doc.fontSize(px(19)).text(money(invoice.totalAmount), x, cy + barH / 2 - px(19) * 0.6, {
    width: w - px(14),
    align: 'right',
    lineBreak: false,
  });
  cy += barH;

  const showBalance = invoice.status !== 'CANCELLED';
  const showPaid = showBalance || paid > 0;
  if (showPaid) {
    cy += px(8);
    line('Amount paid', money(paid), cy, GREEN);
    cy += row;
  }
  if (showBalance) {
    const balance = invoice.status === 'PAID' ? 0 : remainingBalance(invoice.totalAmount, paid);
    const color = balance === 0 ? GREEN : ORANGE;
    cy += px(2);
    const bh = px(11) * 2 + px(17) * 1.2 + 4;
    doc
      .roundedRect(x + 1, cy + 1, w - 2, bh - 2, px(10))
      .lineWidth(2)
      .stroke(color);
    doc
      .font(BOLD)
      .fontSize(px(12))
      .fillColor(color)
      .text('Balance due', x + px(14), cy + bh / 2 - px(12) * 0.6, { lineBreak: false });
    doc.fontSize(px(17)).text(money(balance), x, cy + bh / 2 - px(17) * 0.6, {
      width: w - px(14),
      align: 'right',
      lineBreak: false,
    });
  }
}

/** Greedy split of long text into chunks that each fit `maxHeight`, so notes can run across pages. */
function chunkText(doc: Doc, text: string, width: number, maxHeight: number, firstMax: number): string[] {
  doc.font(REG).fontSize(px(11));
  const opts = { width, lineGap: px(11) * 0.55 };
  if (doc.heightOfString(text, opts) <= firstMax) return [text];
  const tokens = text.split(/(\s+)/);
  const chunks: string[] = [];
  let current = '';
  let limit = firstMax;
  for (const tok of tokens) {
    const candidate = current + tok;
    if (current && doc.heightOfString(candidate.trimEnd(), opts) > limit) {
      chunks.push(current.trimEnd());
      current = tok.trimStart();
      limit = maxHeight;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

function drawLowerSection(doc: Doc, input: InvoicePdfInput, startY: number, newPage: () => number): void {
  const { invoice, currencySymbol } = input;
  const money = (n: number | string) => formatMoney(Number(n), currencySymbol);
  const showBalance = invoice.status !== 'CANCELLED';
  const totalsH = totalsHeight(showBalance || sumOfSettledPayments(invoice.payments) > 0, showBalance);
  const totalsW = px(290);
  const gutter = px(30);
  const leftW = CW - totalsW - gutter;
  const payRowH = px(8) * 2 + px(11) * 1.2 + px(10) * 1.2;

  // Keep the totals block whole: if it can't fit under the table, it moves to a fresh page together with the left column.
  let y = startY;
  if (y + totalsH > CONTENT_BOTTOM) y = newPage();
  drawTotals(doc, input, PAGE_W - MX - totalsW, y, totalsW);

  let ly = y;
  let columnW = leftW;
  const ensure = (needed: number) => {
    if (ly + needed > CONTENT_BOTTOM) {
      ly = newPage();
      columnW = CW;
    }
  };

  if (invoice.payments.length > 0) {
    ensure(px(9) * 1.2 + px(8) + payRowH);
    label(doc, 'Payments received', MX, ly);
    ly += px(9) * 1.2 + px(8);
    for (const p of invoice.payments) {
      ensure(payRowH);
      doc
        .font(BOLD)
        .fontSize(px(11))
        .fillColor(INK)
        .text(p.paymentNumber, MX, ly + px(8), { width: columnW, lineBreak: false });
      doc
        .font(REG)
        .fontSize(px(10))
        .fillColor(MUTED)
        .text(formatInvoiceDate(p.paymentDate), MX, ly + px(8) + px(11) * 1.2, {
          width: columnW,
          lineBreak: false,
        });
      doc
        .font(BOLD)
        .fontSize(px(11))
        .fillColor(INK)
        .text(money(p.finalAmount), MX, ly + px(8), {
          width: columnW,
          align: 'right',
          lineBreak: false,
        });
      ly += payRowH;
    }
    ly += px(18) - px(6);
  }

  const notes = invoice.notes?.trim();
  if (notes) {
    ensure(px(9) * 1.2 + px(6) + px(11) * 2);
    label(doc, 'Notes', MX, ly + px(6));
    ly += px(6) + px(9) * 1.2 + px(6);
    const lineGap = px(11) * 0.55;
    const avail = () => CONTENT_BOTTOM - ly;
    const chunks = chunkText(doc, notes, columnW, CONTENT_BOTTOM - CONT_TOP, avail());
    chunks.forEach((chunk, i) => {
      if (i > 0) {
        ly = newPage();
        columnW = CW;
      }
      doc.font(REG).fontSize(px(11)).fillColor(BODY).text(chunk, MX, ly, { width: columnW, lineGap });
      ly += doc.heightOfString(chunk, { width: columnW, lineGap });
    });
  }
}

function drawFooters(doc: Doc, input: InvoicePdfInput): void {
  const range = doc.bufferedPageRange();
  const text = input.footerText?.trim() || FALLBACK_FOOTER;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .moveTo(MX, FOOTER_RULE_Y)
      .lineTo(PAGE_W - MX, FOOTER_RULE_Y)
      .lineWidth(0.75)
      .stroke('#e1e4f2');
    const pageLabel = `Page ${i + 1} of ${range.count}`;
    doc.font(BOLD).fontSize(px(10));
    const pageW = doc.widthOfString(pageLabel) + 2;
    doc.fillColor(MUTED).text(pageLabel, PAGE_W - MX - pageW, FOOTER_RULE_Y + px(14), {
      width: pageW + 2,
      lineBreak: false,
    });
    doc
      .font(BOLD)
      .fontSize(px(10))
      .fillColor(MUTED)
      .text(text, MX, FOOTER_RULE_Y + px(14), {
        width: CW - pageW - px(20),
        height: 22,
        ellipsis: true,
        lineGap: px(10) * 0.4,
      });
  }
}

export function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: { Title: `Invoice ${input.invoice.invoiceNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // PDFKit's default Helvetica has no ₹ glyph — see core/pdf/pdf-fonts.ts.
      doc.registerFont(REG, PDF_FONT_REGULAR).registerFont(BOLD, PDF_FONT_BOLD);
      const { invoice } = input;

      drawPageChrome(doc, invoice);
      let y = drawHeader(doc, input);
      y = drawMeta(doc, input, y);

      const newPage = (): number => {
        doc.addPage();
        drawPageChrome(doc, invoice);
        return CONT_TOP;
      };

      const items = [...invoice.items].sort((a, b) => a.sortOrder - b.sortOrder);
      const rowHeights = items.map((it) => Math.max(textHeight(doc, it.description, BOLD, px(12), COL_DESC - CELL_PAD_X * 2), px(12) * 1.2) + px(11) * 2 + 1);
      const pages = paginateRows(rowHeights, CONTENT_BOTTOM - y - HEAD_H, CONTENT_BOTTOM - CONT_TOP - HEAD_H);

      pages.forEach((rowIdx, pageNo) => {
        if (pageNo > 0) y = newPage();
        y = drawTableHeader(doc, y);
        for (const i of rowIdx) {
          const it = items[i]!;
          const h = rowHeights[i]!;
          const ty = y + px(11);
          doc
            .font(BOLD)
            .fontSize(px(12))
            .fillColor(INK)
            .text(it.description, MX + CELL_PAD_X, ty, { width: COL_DESC - CELL_PAD_X * 2 });
          doc.font(REG).fillColor(INK);
          doc.text(String(it.quantity), MX + COL_DESC, ty, {
            width: COL_QTY,
            align: 'right',
            lineBreak: false,
          });
          doc.text(formatMoney(Number(it.unitPrice), input.currencySymbol), MX + COL_DESC + COL_QTY, ty, { width: COL_UNIT, align: 'right', lineBreak: false });
          doc
            .font(BOLD)
            .text(formatMoney(Number(it.amount), input.currencySymbol), MX + COL_DESC + COL_QTY + COL_UNIT, ty, { width: COL_AMT - CELL_PAD_X, align: 'right', lineBreak: false });
          doc
            .moveTo(MX, y + h)
            .lineTo(MX + CW, y + h)
            .lineWidth(0.75)
            .stroke(LINE);
          y += h;
        }
      });

      drawLowerSection(doc, input, y + GAP, newPage);
      drawFooters(doc, input);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
