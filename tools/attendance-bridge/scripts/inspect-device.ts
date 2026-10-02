// @ts-expect-error — node-zklib ships no TypeScript types.
import ZKLib from 'node-zklib';

import { config } from '../src/config.js';

/**
 * Run this FIRST against your real unit, before trusting the ZKTeco
 * adapter's field-name guessing (`src/adapters/zkteco.adapter.ts`'s doc
 * comment explains why guessing is necessary at all). Prints the raw shape
 * `getAttendances()` and `getUsers()` return on YOUR specific
 * device/firmware/library-version combination, so you can confirm (or fix)
 * the field names `normalizeLog` checks.
 */
async function main(): Promise<void> {
  const zk = new ZKLib(config.deviceIp, config.devicePort, 10_000, 4_000);
  console.log(`Connecting to ${config.deviceIp}:${config.devicePort}...`);
  await zk.createSocket();

  console.log('\n--- getUsers() sample (first 3) ---');
  const users = await zk.getUsers();
  console.log(JSON.stringify((users?.data ?? users)?.slice?.(0, 3) ?? users, null, 2));

  console.log('\n--- getAttendances() sample (first 3) ---');
  const logs = await zk.getAttendances();
  console.log(JSON.stringify((logs?.data ?? logs)?.slice?.(0, 3) ?? logs, null, 2));

  await zk.disconnect();
}

main().catch((err) => {
  console.error('inspect-device failed:', err);
  process.exit(1);
});
