// @ts-expect-error — node-zklib ships no TypeScript types.
import ZKLib from 'node-zklib';

import type { DeviceAdapter, Punch } from './types.js';

export interface ZkTecoConfig {
  ip: string;
  port: number;
  /** Connection timeout, ms. node-zklib's own default (10000) is usually fine. */
  timeout?: number;
  /** UDP reply port the device connects back on. node-zklib's own default (4000) is usually fine — only change it if something else on this PC already uses that port. */
  inport?: number;
}

/**
 * ZKTeco's TCP protocol (port 4370 by default) via `node-zklib` — the most
 * common/cheapest fingerprint reader family in this product's market, and
 * the one chosen to prove the bridge pipeline end-to-end (see the backend's
 * `AttendanceDevice` model doc comment for the full rationale).
 *
 * CAVEAT: `node-zklib` and its various forks (`zklib-js`, `zkteco-js`, …)
 * are community-reverse-engineered from ZKTeco's undocumented protocol, and
 * the exact field names on a `getAttendances()` log record have drifted
 * across versions/firmwares in the wild (`deviceUserId` vs `userSn` vs
 * `uid` vs `user_id`; `recordTime` vs `timestamp`). This adapter checks
 * every variant seen in published examples, but if punches silently don't
 * come through, run `npm run inspect-device` first (`scripts/inspect-device.ts`)
 * to print the raw shape your specific unit actually returns, and add
 * whatever field name is missing to the lists below.
 */
export class ZkTecoAdapter implements DeviceAdapter {
  private zk: any;

  constructor(private readonly config: ZkTecoConfig) {
    this.zk = new ZKLib(config.ip, config.port, config.timeout ?? 10_000, config.inport ?? 4_000);
  }

  async connect(): Promise<void> {
    await this.zk.createSocket();
  }

  async disconnect(): Promise<void> {
    await this.zk.disconnect();
  }

  async fetchPunchesSince(sinceIso: string | null): Promise<Punch[]> {
    const result = await this.zk.getAttendances();
    const rawLogs: unknown[] = Array.isArray(result) ? result : (result?.data ?? []);
    const since = sinceIso ? new Date(sinceIso) : null;

    const punches = rawLogs
      .map(normalizeLog)
      .filter((p): p is Punch => p !== null)
      .filter((p) => !since || new Date(p.timestamp) > since);

    punches.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return punches;
  }
}

function normalizeLog(raw: unknown): Punch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const log = raw as Record<string, unknown>;

  const deviceUserId = firstDefined(log.deviceUserId, log.userSn, log.uid, log.user_id, log.userId);
  const rawTime = firstDefined(log.recordTime, log.record_time, log.timestamp, log.time);
  if (deviceUserId === undefined || rawTime === undefined) return null;

  const time = rawTime instanceof Date ? rawTime : new Date(String(rawTime));
  if (Number.isNaN(time.getTime())) return null;

  return { deviceUserId: String(deviceUserId), timestamp: time.toISOString() };
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((v) => v !== undefined && v !== null);
}
