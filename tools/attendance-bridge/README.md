# FitCloud Attendance Bridge

A small on-prem agent that polls a LAN-connected fingerprint/biometric attendance reader and forwards punches to your FitCloud tenant, so front-desk check-in/check-out happens automatically from the device.

Runs on a PC or mini-PC at the gym, on the same network as the reader — **not** deployed to FitCloud's servers, and not part of the main `gym-management` pnpm workspace (standalone `package.json`, installed/run separately).

## Why this exists

Budget biometric readers (ZKTeco, eSSL, Realtime, Matrix, …) sit on the gym's local network and can't call FitCloud's cloud API directly. This agent bridges that gap: it polls the device over your LAN, and pushes each punch to `POST /attendance-devices/punches` on your own tenant's subdomain — the same endpoint a device with native cloud-push support could call directly instead, if yours has that.

No fingerprint data ever leaves the device. It only ever reports a User ID + a timestamp — matching that User ID to a member happens via the **Biometric ID** field on the member's profile in FitCloud, which staff fill in once after enrolling the member's fingerprint on the physical unit.

## Setup

1. **Register the device in FitCloud** — tenant-web → Settings → Attendance Devices → Register device. Copy the API key shown (it's shown exactly once).
2. **Enroll members on the physical unit** — follow the device's own menu to enroll a fingerprint; it assigns a numeric User ID. Type that same ID into the member's **Biometric ID** field on their profile page in FitCloud.
3. **Configure this agent**: `cp .env.example .env` and fill in `API_BASE_URL` (your tenant's own subdomain, e.g. `https://acmegym.fitcloud.app/api/v1`), `DEVICE_API_KEY` (from step 1), and `DEVICE_IP`/`DEVICE_PORT` (the reader's address on your LAN — ZKTeco units default to port 4370).
4. **Install and run**:
   ```bash
   npm install
   npm start
   ```
   The agent connects, then polls every `POLL_INTERVAL_MS` (default 15s) for new punches and forwards each one.
5. **(Recommended) Make it start automatically on boot** — see below. Otherwise someone has to run `npm start` by hand every time the PC restarts.

## Auto-start on boot (Windows)

Gym staff shouldn't have to think about this agent day to day. Installing it as a Windows Service makes it start automatically on every boot (even before anyone logs in), restart itself if it ever crashes, and run with no console window to accidentally close.

1. Finish the Setup steps above first (`.env` must already exist and be filled in).
2. Build it: `npm run build` (compiles to `dist/`; the service runs the compiled output, not `tsx`).
3. Open a terminal **as Administrator** (right-click → "Run as administrator") and run:
   ```bash
   npm run service:install
   ```
4. Confirm it's running: open Windows **Services** (`services.msc`) and look for **"FitCloud Attendance Bridge"** — status should be "Running," startup type "Automatic."

To remove it later (e.g. before reinstalling, or decommissioning that PC), run `npm run service:uninstall`, also as Administrator.

**After rotating a device's API key** (Settings → Attendance Devices → Regenerate key), update `.env` with the new key, then restart the service — either `services.msc` → right-click → Restart, or from an Administrator terminal: `net stop "FitCloud Attendance Bridge" && net start "FitCloud Attendance Bridge"`.

**Not on Windows?** `install-service.js`/`uninstall-service.js` only work there. On Linux/macOS, use a systemd unit or launchd plist pointing at `node dist/index.js` instead (not provided here) — functionally the same idea, different OS mechanism.

## Only ZKTeco ships today

The device-specific logic lives behind one interface (`src/adapters/types.ts`, `DeviceAdapter`) — `src/adapters/zkteco.adapter.ts` is the only implementation so far, using the open-source `node-zklib` package (TCP, no vendor SDK or Windows dependency). Adding another vendor means writing a new file implementing that same interface, not touching the server or the rest of this agent.

**Before relying on the ZKTeco adapter against a real unit**, run `npm run inspect-device` first. ZKTeco's protocol is community-reverse-engineered, and field names on a punch record have drifted across `node-zklib` forks/firmwares — this script prints the raw shape your specific device returns so you can confirm (or fix) the field-name guessing in `zkteco.adapter.ts`'s `normalizeLog`.

## Reliability notes

- Punches are de-duplicated locally (`CURSOR_FILE`, default `.cursor.json`) so a restart doesn't re-send (and double-toggle check-in/check-out for) old punches. Safe to delete for a clean resync.
- A network failure while forwarding is retried on the next poll; a rejection from the server (unenrolled user, member not eligible, already checked in) is logged and NOT retried — retrying a business-rule rejection would just loop forever.
- Keep the device's clock in sync (NTP) — punch timestamps come from the device, not from whenever the bridge happens to forward them.
