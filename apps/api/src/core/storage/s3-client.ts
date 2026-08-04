import { S3Client } from '@aws-sdk/client-s3';

import { env } from '../../config/env';

let client: S3Client | undefined;

/** Throws if called while `env.storage.isConfigured` is false — callers must check that first (see `storage.service.ts`). */
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.storage.endpoint,
      region: env.storage.region,
      forcePathStyle: env.storage.forcePathStyle,
      credentials: {
        accessKeyId: env.storage.accessKeyId!,
        secretAccessKey: env.storage.secretAccessKey!,
      },
    });
  }
  return client;
}
