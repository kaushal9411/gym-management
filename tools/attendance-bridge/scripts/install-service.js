// Registers this agent as a real Windows Service — starts automatically on
// boot (before any user logs in), restarts itself if it crashes, and runs
// with no visible console window. Run ONCE per PC, as Administrator:
//   npm run service:install
//
// Windows only. Requires `npm run build` to have been run first (the
// service runs the compiled `dist/index.js` via plain `node`, not `tsx` —
// a production service shouldn't depend on a TS-transpiling dev runtime).

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

if (process.platform !== 'win32') {
  console.error('service:install only works on Windows. On Linux/macOS, use systemd/launchd instead (not provided here).');
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryScript = path.join(projectRoot, 'dist', 'index.js');

if (!existsSync(entryScript)) {
  console.error(`${entryScript} does not exist — run "npm run build" first.`);
  process.exit(1);
}
if (!existsSync(path.join(projectRoot, '.env'))) {
  console.error(`No .env found in ${projectRoot} — copy .env.example to .env and fill it in before installing the service.`);
  process.exit(1);
}

const { Service } = (await import('node-windows')).default;

const svc = new Service({
  name: 'FitCloud Attendance Bridge',
  description: 'Forwards fingerprint/biometric attendance punches from a LAN-connected reader to FitCloud.',
  script: entryScript,
  workingDirectory: projectRoot,
});

svc.on('install', () => {
  console.log('Service installed. Starting it now...');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('Already installed — run "npm run service:uninstall" first if you want to reinstall.'));
svc.on('start', () => console.log('Service started. It will now also start automatically on every boot.'));
svc.on('error', (err) => console.error('Service error:', err));

svc.install();
