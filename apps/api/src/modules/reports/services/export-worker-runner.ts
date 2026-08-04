import path from 'node:path';
import { Worker } from 'node:worker_threads';

import type { ExportTable } from './export-render';

const IS_TS_RUNTIME = __filename.endsWith('.ts');
const WORKER_PATH = path.join(__dirname, IS_TS_RUNTIME ? 'export-render.worker.ts' : 'export-render.worker.js');

/**
 * Excel/PDF rendering (ExcelJS zip compression, PDFKit's per-cell text
 * layout across up to 2000 rows) is real synchronous CPU work — running it
 * inline in the request handler blocks the single Node event loop for
 * every other concurrent request on this instance. Offloading it to a
 * `worker_thread` is what actually fixes that (unlike routing it through
 * BullMQ: every job worker in this codebase — `email.worker.ts`,
 * `scheduler-engine.service.ts` — runs in-process on the SAME event loop
 * as Express, so queueing alone wouldn't have helped). CSV stays inline —
 * it's cheap string concatenation, not worth the worker round-trip.
 */
export function renderInWorker(format: 'excel' | 'pdf', table: ExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: { format, table },
      execArgv: IS_TS_RUNTIME ? ['--require', 'tsx/cjs'] : [],
    });

    worker.once('message', (result: Buffer | { __workerError: string }) => {
      if (result && typeof result === 'object' && '__workerError' in result) {
        reject(new Error(result.__workerError));
      } else {
        resolve(Buffer.from(result as Buffer));
      }
      void worker.terminate();
    });
    worker.once('error', (err) => {
      reject(err);
      void worker.terminate();
    });
  });
}
