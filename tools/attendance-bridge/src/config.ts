import { fileURLToPath } from 'node:url';
import path from 'node:path';

import dotenv from 'dotenv';

// Resolved from this file's own location, not process.cwd() — a Windows
// Service (see scripts/install-service.js) can launch node from a different
// working directory than this project's folder, so a relative `.env` lookup
// would silently fail there even though `npm start` (cwd already correct)
// works fine in manual testing. This way both launch paths behave the same.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env (in ${projectRoot}) and fill it in.`);
  return value;
}

export const config = {
  apiBaseUrl: required('API_BASE_URL'), // e.g. https://acmegym.fitcloud.app/api/v1 — the TENANT'S OWN subdomain, same as the mobile app/tenant-web use
  deviceApiKey: required('DEVICE_API_KEY'), // from "Register device" in Settings → Attendance Devices — shown once, store it here
  deviceVendor: process.env.DEVICE_VENDOR ?? 'ZKTECO',
  deviceIp: required('DEVICE_IP'),
  devicePort: Number(process.env.DEVICE_PORT ?? 4370),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 15_000),
  // Absolute, same CWD-independence reason as .env above — a relative path
  // here would otherwise create/read the cursor file wherever the service
  // happened to be launched from, not next to the project.
  cursorFile: path.isAbsolute(process.env.CURSOR_FILE ?? '') ? process.env.CURSOR_FILE! : path.join(projectRoot, process.env.CURSOR_FILE ?? '.cursor.json'),
};
