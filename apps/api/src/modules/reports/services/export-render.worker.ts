import { parentPort, workerData } from 'node:worker_threads';

import { renderExcelBuffer, renderPdfBuffer, type ExportTable } from './export-render';

/**
 * Runs off the main thread — see `renderInWorker()` in `report-export.service.ts`
 * for why. Everything here must stay pure (no Prisma/DB access, no request
 * context): `workerData` is a structured-clone of whatever was already
 * fetched on the main thread.
 */
async function run(): Promise<void> {
  if (!parentPort) throw new Error('export-render.worker.ts must be run as a worker_thread');

  const { format, table } = workerData as { format: 'excel' | 'pdf'; table: ExportTable };
  const buffer = format === 'excel' ? await renderExcelBuffer(table) : await renderPdfBuffer(table);
  parentPort.postMessage(buffer);
}

run().catch((error: unknown) => {
  if (parentPort) parentPort.postMessage({ __workerError: error instanceof Error ? error.message : String(error) });
});
