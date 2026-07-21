'use client';

import * as React from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { fileToDataUrl, fileToRawDataUrl } from '@/lib/image-to-data-url';
import { cn } from '@/lib/utils';
import { useDeleteMemberDocument, useMemberDocuments, useUploadMemberDocument } from '../hooks/use-members';
import type { MemberDocumentType } from '../types';

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

const DOCUMENT_TYPES: Array<{ value: MemberDocumentType; label: string }> = [
  { value: 'IDENTITY_PROOF', label: 'Identity proof' },
  { value: 'ADDRESS_PROOF', label: 'Address proof' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical certificate' },
  { value: 'CONSENT_FORM', label: 'Consent form' },
  { value: 'OTHER', label: 'Other' },
];

const selectClassName = cn(
  'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface DocumentUploadProps {
  memberId: string;
  disabled?: boolean;
}

/** Document Management section — list, upload (image or PDF), and delete. */
export function DocumentUpload({ memberId, disabled }: DocumentUploadProps) {
  const documents = useMemberDocuments(memberId);
  const upload = useUploadMemberDocument();
  const remove = useDeleteMemberDocument();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [type, setType] = React.useState<MemberDocumentType>('IDENTITY_PROOF');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = file.type.startsWith('image/')
        ? await fileToDataUrl(file, 1280)
        : await fileToRawDataUrl(file, MAX_DOCUMENT_BYTES);
      upload.mutate(
        { id: memberId, type, fileName: file.name, fileDataUrl: dataUrl },
        {
          onSuccess: () => toast.success('Document uploaded'),
          onError: () => toast.error('Could not upload that document'),
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  };

  return (
    <div className="space-y-4">
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClassName}
            value={type}
            onChange={(e) => setType(e.target.value as MemberDocumentType)}
            aria-label="Document type"
          >
            {DOCUMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> {upload.isPending ? 'Uploading…' : 'Upload document'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {(documents.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          documents.data!.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-lg border p-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <a href={doc.fileDataUrl} download={doc.fileName} className="flex-1 truncate text-sm hover:underline">
                {doc.fileName}
              </a>
              <Label className="shrink-0 text-xs font-normal text-muted-foreground">
                {DOCUMENT_TYPES.find((t) => t.value === doc.type)?.label ?? doc.type}
              </Label>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: memberId, documentId: doc.id }, { onSuccess: () => toast.success('Document deleted') })}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
