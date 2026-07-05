import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

export class AdminReferenceDataService {
  // ── Countries ──
  async listCountries() {
    return prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  async upsertCountry(code: string, name: string, isActive: boolean, adminUserId: string, adminRole: string) {
    const country = await prisma.country.upsert({ where: { code: code.toUpperCase() }, create: { code: code.toUpperCase(), name, isActive }, update: { name, isActive } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.country_upserted', entityType: 'Country', entityId: country.id });
    return country;
  }

  // ── Currencies ──
  async listCurrencies() {
    return prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async upsertCurrency(code: string, name: string, symbol: string, isActive: boolean, adminUserId: string, adminRole: string) {
    const currency = await prisma.currency.upsert({
      where: { code: code.toUpperCase() },
      create: { code: code.toUpperCase(), name, symbol, isActive },
      update: { name, symbol, isActive },
    });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.currency_upserted', entityType: 'Currency', entityId: currency.id });
    return currency;
  }

  // ── Tax rules (table already exists — Prompt 8) ──
  async listTaxRules() {
    return prisma.taxRule.findMany({ orderBy: [{ countryCode: 'asc' }, { stateCode: 'asc' }] });
  }

  async upsertTaxRule(input: { countryCode: string; stateCode?: string; label: string; ratePercent: number; isActive: boolean }, adminUserId: string, adminRole: string) {
    const existing = await prisma.taxRule.findFirst({ where: { countryCode: input.countryCode, stateCode: input.stateCode ?? null } });
    const rule = existing
      ? await prisma.taxRule.update({ where: { id: existing.id }, data: { label: input.label, ratePercent: input.ratePercent, isActive: input.isActive } })
      : await prisma.taxRule.create({ data: { ...input, stateCode: input.stateCode ?? null } });

    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tax_rule_upserted', entityType: 'TaxRule', entityId: rule.id });
    return rule;
  }

  async removeTaxRule(id: string, adminUserId: string, adminRole: string): Promise<void> {
    await prisma.taxRule.delete({ where: { id } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.tax_rule_deleted', entityType: 'TaxRule', entityId: id });
  }
}

export const adminReferenceDataService = new AdminReferenceDataService();
