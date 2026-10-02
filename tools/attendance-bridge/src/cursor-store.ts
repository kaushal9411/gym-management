import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Tracks the last successfully-forwarded punch timestamp and a small ring of
 * recently-sent (deviceUserId, timestamp) pairs, persisted to a local JSON
 * file — survives a bridge restart without re-sending (and double-toggling
 * check-in/check-out for) punches the server already has. A second,
 * independent safety net on top of `fetchPunchesSince`'s own `since` filter.
 */
export class CursorStore {
  private lastTimestamp: string | null = null;
  private recentlySent = new Set<string>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  get since(): string | null {
    return this.lastTimestamp;
  }

  alreadySent(deviceUserId: string, timestamp: string): boolean {
    return this.recentlySent.has(`${deviceUserId}|${timestamp}`);
  }

  markSent(deviceUserId: string, timestamp: string): void {
    this.recentlySent.add(`${deviceUserId}|${timestamp}`);
    if (!this.lastTimestamp || timestamp > this.lastTimestamp) this.lastTimestamp = timestamp;
    this.save();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf-8')) as { lastTimestamp: string | null; recentlySent: string[] };
      this.lastTimestamp = data.lastTimestamp;
      this.recentlySent = new Set(data.recentlySent);
    } catch {
      // Corrupt/empty cursor file — start fresh rather than crash the agent.
    }
  }

  private save(): void {
    // Cap the ring so the file can't grow unbounded on a long-running agent.
    const recentlySent = [...this.recentlySent].slice(-2000);
    this.recentlySent = new Set(recentlySent);
    writeFileSync(this.filePath, JSON.stringify({ lastTimestamp: this.lastTimestamp, recentlySent }, null, 2));
  }
}
