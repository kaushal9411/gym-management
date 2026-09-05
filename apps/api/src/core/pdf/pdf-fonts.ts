import { join } from 'node:path';

/**
 * PDFKit's built-in "standard 14" fonts (Helvetica, Times, Courier — the
 * ones you get without registering anything) are limited to WinAnsiEncoding
 * and do NOT include `₹` (U+20B9) or most other non-Latin-1 currency
 * symbols — confirmed live: an invoice PDF rendered `₹` as a garbled
 * fallback glyph. DejaVu Sans has full Unicode coverage (including ₹) and a
 * permissive (Bitstream Vera) license that allows bundling — see
 * `assets/fonts/DejaVuSans-LICENSE.txt`. Every PDFDocument that prints a
 * currency amount must `doc.registerFont('body', PDF_FONT_REGULAR)` (and
 * `.font('body')`) instead of relying on the PDFKit default.
 */
export const PDF_FONT_REGULAR = join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
export const PDF_FONT_BOLD = join(process.cwd(), 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
