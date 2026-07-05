import { prisma } from '../../../infrastructure/database/prisma';

export interface TaxCalculation {
  ratePercent: number;
  taxAmount: number;
  label: string | null;
}

/**
 * Flat rate lookup, not a full tax-jurisdiction engine — `tax_rules` is a
 * small seeded table (prisma/seed.ts) of country (+ optional state) rates.
 * State-specific rows take priority over a country-wide fallback
 * (`stateCode = null`); no matching rule means no tax is charged.
 */
export class TaxService {
  async calculate(countryCode: string, stateCode: string | undefined, amount: number): Promise<TaxCalculation> {
    const rule =
      (stateCode &&
        (await prisma.taxRule.findFirst({ where: { countryCode, stateCode, isActive: true } }))) ||
      (await prisma.taxRule.findFirst({ where: { countryCode, stateCode: null, isActive: true } }));

    if (!rule) return { ratePercent: 0, taxAmount: 0, label: null };

    const ratePercent = Number(rule.ratePercent);
    const taxAmount = Math.round(amount * (ratePercent / 100) * 100) / 100;
    return { ratePercent, taxAmount, label: rule.label };
  }
}

export const taxService = new TaxService();
