import type { DeviceAdapter, Punch } from './adapters/types.js';
import { ZkTecoAdapter } from './adapters/zkteco.adapter.js';
import { config } from './config.js';
import { CursorStore } from './cursor-store.js';

function buildAdapter(): DeviceAdapter {
  switch (config.deviceVendor) {
    case 'ZKTECO':
      return new ZkTecoAdapter({ ip: config.deviceIp, port: config.devicePort });
    default:
      throw new Error(
        `Unsupported DEVICE_VENDOR "${config.deviceVendor}". Only ZKTECO ships today — implement a new DeviceAdapter under src/adapters/ for anything else (see src/adapters/types.ts).`,
      );
  }
}

/** Forwards one punch to the tenant's own API. Resolves to true if the cursor should advance past this punch (sent, or a non-retryable rejection) — false only on a transient failure worth retrying next poll. */
async function forwardPunch(punch: Punch): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/attendance-devices/punches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': config.deviceApiKey },
      body: JSON.stringify({ deviceUserId: punch.deviceUserId, timestamp: punch.timestamp }),
    });

    if (res.ok) {
      console.log(`[bridge] punch recorded: user ${punch.deviceUserId} @ ${punch.timestamp}`);
      return true;
    }

    // 401 (bad/disabled key) is a config problem — worth surfacing loudly,
    // but still not retryable by waiting, so don't spin on it forever.
    // 404/409 (unenrolled user, not eligible, already checked in) are real
    // business outcomes, not transient failures — advance past them too.
    const body = await res.text().catch(() => '');
    console.warn(`[bridge] server rejected punch (${res.status}): user ${punch.deviceUserId} @ ${punch.timestamp} — ${body}`);
    return true;
  } catch (err) {
    console.error(`[bridge] network error forwarding punch, will retry next poll:`, err);
    return false;
  }
}

async function pollOnce(adapter: DeviceAdapter, cursor: CursorStore): Promise<void> {
  const punches = await adapter.fetchPunchesSince(cursor.since);
  for (const punch of punches) {
    if (cursor.alreadySent(punch.deviceUserId, punch.timestamp)) continue;
    const advance = await forwardPunch(punch);
    if (advance) cursor.markSent(punch.deviceUserId, punch.timestamp);
  }
}

async function main(): Promise<void> {
  const adapter = buildAdapter();
  const cursor = new CursorStore(config.cursorFile);

  console.log(`[bridge] connecting to ${config.deviceVendor} device at ${config.deviceIp}:${config.devicePort}...`);
  await adapter.connect();
  console.log(`[bridge] connected. Polling every ${config.pollIntervalMs}ms, forwarding to ${config.apiBaseUrl}`);

  const stop = async (): Promise<never> => {
    console.log('[bridge] shutting down...');
    await adapter.disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  for (;;) {
    try {
      await pollOnce(adapter, cursor);
    } catch (err) {
      console.error('[bridge] poll failed, will retry next interval:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error('[bridge] fatal error:', err);
  process.exit(1);
});
