// Removes the Windows Service installed by install-service.js. Run as
// Administrator:
//   npm run service:uninstall

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.platform !== 'win32') {
  console.error('service:uninstall only works on Windows.');
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryScript = path.join(projectRoot, 'dist', 'index.js');

const { Service } = (await import('node-windows')).default;

const svc = new Service({
  name: 'FitCloud Attendance Bridge',
  script: entryScript,
});

svc.on('uninstall', () => console.log('Service removed. It will no longer start on boot.'));
svc.on('error', (err) => console.error('Service error:', err));

svc.uninstall();
