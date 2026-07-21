import { describe, expect, it } from 'vitest';

import {
  updateBrandingSchema,
  updateContactInfoSchema,
  updateInvoiceSettingsSchema,
  uploadImageSchema,
} from './settings.validators';

describe('settings validators', () => {
  describe('updateContactInfoSchema', () => {
    it('accepts a valid partial update', () => {
      const result = updateContactInfoSchema.safeParse({ phone: '+1 555-0100', latitude: 12.9716, longitude: 77.5946 });
      expect(result.success).toBe(true);
    });

    it('rejects an out-of-range latitude', () => {
      const result = updateContactInfoSchema.safeParse({ latitude: 200 });
      expect(result.success).toBe(false);
    });

    it('rejects an empty body (nothing to update)', () => {
      const result = updateContactInfoSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('allows explicit null to clear a field', () => {
      const result = updateContactInfoSchema.safeParse({ website: null });
      expect(result.success).toBe(true);
    });
  });

  describe('updateBrandingSchema', () => {
    it('accepts an oklch color string', () => {
      const result = updateBrandingSchema.safeParse({ primaryColor: 'oklch(0.51 0.23 277)' });
      expect(result.success).toBe(true);
    });

    it('accepts a hex color string', () => {
      const result = updateBrandingSchema.safeParse({ secondaryColor: '#4f46e5' });
      expect(result.success).toBe(true);
    });

    it('rejects a color value containing unsafe characters', () => {
      const result = updateBrandingSchema.safeParse({ primaryColor: 'red; background:url(javascript:alert(1))' });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown theme value', () => {
      const result = updateBrandingSchema.safeParse({ theme: 'NEON' });
      expect(result.success).toBe(false);
    });
  });

  describe('uploadImageSchema', () => {
    it('accepts a small base64 PNG data URL', () => {
      const result = uploadImageSchema.safeParse({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
      expect(result.success).toBe(true);
    });

    it('rejects a non-data-URL string', () => {
      const result = uploadImageSchema.safeParse({ dataUrl: 'https://example.com/logo.png' });
      expect(result.success).toBe(false);
    });

    it('rejects an oversized payload', () => {
      const huge = `data:image/png;base64,${'A'.repeat(400_001)}`;
      const result = uploadImageSchema.safeParse({ dataUrl: huge });
      expect(result.success).toBe(false);
    });
  });

  describe('updateInvoiceSettingsSchema', () => {
    it('accepts a valid prefix and tax percentage', () => {
      const result = updateInvoiceSettingsSchema.safeParse({ invoicePrefix: 'INV-2026', taxPercentage: 18.5 });
      expect(result.success).toBe(true);
    });

    it('rejects a tax percentage over 100', () => {
      const result = updateInvoiceSettingsSchema.safeParse({ taxPercentage: 150 });
      expect(result.success).toBe(false);
    });

    it('rejects an invoice prefix with invalid characters', () => {
      const result = updateInvoiceSettingsSchema.safeParse({ invoicePrefix: 'INV_2026!' });
      expect(result.success).toBe(false);
    });
  });
});
