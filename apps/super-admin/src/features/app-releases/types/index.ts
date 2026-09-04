export interface AppRelease {
  id: string;
  platform: 'ANDROID';
  version: string;
  versionCode: number;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: string;
  releaseNotes: string | null;
  isActive: boolean;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateAppReleasePayload {
  file: File;
  version: string;
  versionCode: number;
  releaseNotes?: string;
  activate?: boolean;
}
