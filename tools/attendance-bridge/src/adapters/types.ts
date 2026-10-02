/** Normalized punch — every vendor adapter below must translate its own device's protocol into exactly this shape. Must match the API's `DevicePunchInput` (`apps/api/src/modules/attendance-devices/dto/attendance-device.dto.ts`). */
export interface Punch {
  deviceUserId: string;
  /** ISO 8601. Taken from the device's own clock, not when the bridge happens to forward it — keep the device's clock in sync (NTP) so attendance timestamps stay accurate even if the bridge falls behind on a flaky connection. */
  timestamp: string;
}

/**
 * One adapter per device vendor. The bridge's main loop (`src/index.ts`)
 * only ever talks to this interface — swapping vendors is a config change
 * (`DEVICE_VENDOR` in `.env`) plus a new file here, never a server change.
 */
export interface DeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** All punches since `sinceIso` (inclusive), oldest first. The adapter owns de-duplication against the device's own storage; the bridge's cursor store (`src/cursor-store.ts`) de-dupes again on the forwarding side, so either layer being imperfect is still safe. */
  fetchPunchesSince(sinceIso: string | null): Promise<Punch[]>;
}
