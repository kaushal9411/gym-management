import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Pure rendering — no Prisma/DB, no request context. Deliberately kept
 * import-light and side-effect-free so `export-render.worker.ts` can run
 * it inside a `worker_thread` with nothing but the `workerData` payload.
 */
export interface ExportTable {
  title: string;
  columns: string[];
  rows: unknown[];
}

function asRecord(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function renderCsv(table: ExportTable): string {
  const lines = [table.columns.join(',')];
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => escapeCsv(asRecord(row)[c])).join(','));
  }
  return lines.join('\n');
}

export async function renderExcelBuffer(table: ExportTable): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.title.slice(0, 31));
  sheet.columns = table.columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of table.rows) sheet.addRow(asRecord(row));
  return workbook.xlsx.writeBuffer();
}

export function renderPdfBuffer(table: ExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: table.columns.length > 5 ? 'landscape' : 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(table.title);
    doc.moveDown();

    const colWidth = (doc.page.width - 80) / table.columns.length;
    let y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    table.columns.forEach((c, i) => doc.text(c, 40 + i * colWidth, y, { width: colWidth }));
    y += 16;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
    y += 4;
    doc.font('Helvetica');

    for (const row of table.rows) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      table.columns.forEach((c, i) => doc.text(String(asRecord(row)[c] ?? ''), 40 + i * colWidth, y, { width: colWidth }));
      y += 14;
    }
    doc.end();
  });
}
