/**
 * One-off data migration for Prompt 43 (field-level encryption for
 * Member.email/phone) — encrypts every existing plaintext row and computes
 * its blind-index hash. Safe to re-run: only touches rows where
 * `email_hash`/`phone_hash` is still NULL, so an already-migrated row is a
 * no-op the second time. Run once after the `member_pii_encryption`
 * migration is applied and before/alongside deploying the app code that
 * expects `email`/`phone` to already be ciphertext:
 *
 *   pnpm --filter api exec tsx scripts/backfill-member-pii.ts
 */
import { prisma } from '../src/infrastructure/database/prisma';
import { encryptEmail, encryptPhone, hashEmail, hashPhone } from '../src/modules/members/utils/member-pii.util';

async function main() {
  const rows = await prisma.member.findMany({
    where: { OR: [{ email: { not: null }, emailHash: null }, { phone: { not: null }, phoneHash: null }] },
    select: { id: true, email: true, phone: true },
  });

  console.log(`Found ${rows.length} member row(s) needing PII backfill.`);

  let updated = 0;
  for (const row of rows) {
    const data: { email?: string; emailHash?: string; phone?: string; phoneHash?: string } = {};
    if (row.email) {
      data.email = encryptEmail(row.email);
      data.emailHash = hashEmail(row.email);
    }
    if (row.phone) {
      data.phone = encryptPhone(row.phone);
      data.phoneHash = hashPhone(row.phone);
    }
    // eslint-disable-next-line no-await-in-loop -- one-off backfill script, not a request-path hot loop
    await prisma.member.update({ where: { id: row.id }, data });
    updated += 1;
  }

  console.log(`Backfilled ${updated} member row(s).`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
