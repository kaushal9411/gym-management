/**
 * One-off backfill: creates/resizes the "Balance due" invoice for every
 * member's live memberships, so memberships that were part-paid (or never
 * paid) before MemberBalanceService existed show up in invoice-based totals.
 * Safe to re-run — it only converges each membership to price - payments.
 *
 *   pnpm exec tsx scripts/reconcile-balance-invoices.ts
 */
import { prisma } from '../src/infrastructure/database/prisma';
import { MemberBalanceService } from '../src/modules/finance/services/member-balance.service';

async function main(): Promise<void> {
  console.log('start');
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  for (const tenant of tenants) {
    const members = await prisma.member.findMany({ where: { tenantId: tenant.id, deletedAt: null }, select: { id: true } });
    const service = new MemberBalanceService(tenant.id);
    for (const member of members) await service.reconcileForMember(member.id);
    console.log(`${tenant.slug}: reconciled ${members.length} members`);
  }
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
