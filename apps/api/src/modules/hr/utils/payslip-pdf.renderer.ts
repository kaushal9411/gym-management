import PDFDocument from 'pdfkit';

import { PDF_FONT_BOLD, PDF_FONT_REGULAR } from '../../../core/pdf/pdf-fonts';
import type { PayslipDto } from '../dto/hr.dto';

import { monthLabel } from './hr-dates.util';

const fmt = (n: number): string => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Single-page payslip (A4). Pure rendering — takes the already-built payslip DTO. */
export function renderPayslipPdf(payslip: PayslipDto, tenantName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', PDF_FONT_REGULAR);
    doc.registerFont('bold', PDF_FONT_BOLD);

    const left = 48;
    const right = doc.page.width - 48;
    const width = right - left;

    doc.font('bold').fontSize(18).fillColor('#171a2e').text(tenantName, left, 48);
    doc.font('regular').fontSize(11).fillColor('#6b7090').text(`Payslip — ${monthLabel(payslip.month)}`, left, 72);
    doc.moveTo(left, 96).lineTo(right, 96).strokeColor('#eceef7').stroke();

    doc.font('bold').fontSize(12).fillColor('#171a2e').text(payslip.employee.name, left, 108);
    doc.font('regular').fontSize(10).fillColor('#4a4f70').text(`${payslip.employee.employeeId} · ${payslip.employee.role}`, left, 124);
    doc.text(payslip.status === 'PAID' ? `Paid${payslip.paidOn ? ` on ${payslip.paidOn}` : ''}${payslip.paymentMode ? ` via ${payslip.paymentMode.replace('_', ' ')}` : ''}` : 'Not yet paid', left, 138);

    // attendance summary
    let y = 168;
    doc.font('bold').fontSize(10).fillColor('#6b7090').text('ATTENDANCE', left, y);
    y += 16;
    const att: Array<[string, string]> = [
      ['Working days', String(payslip.workingDays)],
      ['Present', String(payslip.presentDays)],
      ['Half days', String(payslip.halfDays)],
      ['Paid leave', String(payslip.paidLeaveDays)],
      ['Unpaid leave', String(payslip.unpaidLeaveDays)],
      ['Absent', String(payslip.absentDays)],
      ['Unpaid days (total)', String(payslip.unpaidDays)],
    ];
    doc.font('regular').fontSize(10).fillColor('#4a4f70');
    att.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(`${k}: ${v}`, left + col * (width / 2), y + row * 15);
    });
    y += Math.ceil(att.length / 2) * 15 + 16;

    const line = (label: string, amount: number, bold = false) => {
      doc.font(bold ? 'bold' : 'regular').fontSize(10).fillColor('#171a2e').text(label, left, y, { width: width - 120 });
      doc.text(fmt(amount), right - 120, y, { width: 120, align: 'right' });
      y += 16;
    };
    const heading = (t: string) => {
      doc.font('bold').fontSize(10).fillColor('#6b7090').text(t, left, y);
      y += 16;
    };

    heading('EARNINGS');
    line('Base salary', payslip.baseSalary);
    for (const l of payslip.lines.filter((x) => x.type === 'ALLOWANCE' && x.source === 'STRUCTURE')) line(l.name, l.amount);
    if (payslip.attendanceDeduction > 0) line(`Attendance deduction (${payslip.unpaidDays} day(s) × ${fmt(payslip.dailyRate)})`, -payslip.attendanceDeduction);
    if (payslip.overtimePay > 0) line('Overtime', payslip.overtimePay);
    for (const l of payslip.lines.filter((x) => x.type === 'ALLOWANCE' && x.source === 'MANUAL')) line(l.name, l.amount);
    if (payslip.bonus > 0) line('Bonus', payslip.bonus);
    line('Gross earnings', payslip.grossEarnings, true);
    y += 8;

    heading('DEDUCTIONS');
    for (const l of payslip.lines.filter((x) => x.type === 'DEDUCTION')) line(l.name, l.amount);
    if (payslip.latePenalty > 0) line('Late penalty', payslip.latePenalty);
    if (payslip.advanceRecovery > 0) line('Advance recovery', payslip.advanceRecovery);
    line('Total deductions', payslip.totalDeductions, true);
    y += 8;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#eceef7').stroke();
    y += 10;
    doc.font('bold').fontSize(13).fillColor('#4338ca').text('Net pay', left, y);
    doc.text(fmt(payslip.netPay), right - 160, y, { width: 160, align: 'right' });

    doc.font('regular').fontSize(8).fillColor('#9aa0bd').text('This is a computer-generated payslip.', left, doc.page.height - 72, { width, align: 'center' });
    doc.end();
  });
}
