'use client';

import * as React from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { useRemoveMemberPhoto, useUploadMemberPhoto } from '../../hooks/use-member-portal';
import { ProfileRequestError } from '../../services/member-profile.service';
import { initials } from '../../lib/format';
import { SheetModal } from '../kit';
import { fileToSquareJpeg } from './image-crop';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Photo flow: choose / take -> client crop+resize+compress -> live preview -> Save | Cancel | Remove. */
export function PhotoSheet({ open, onOpenChange, name, photoUrl }: { open: boolean; onOpenChange: (o: boolean) => void; name: string; photoUrl: string | null }) {
  const upload = useUploadMemberPhoto();
  const remove = useRemoveMemberPhoto();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const busy = upload.isPending || remove.isPending;

  const close = (o: boolean) => {
    if (busy) return;
    if (!o) {
      setPreview(null);
      setError(null);
      setProgress(0);
    }
    onOpenChange(o);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Please choose a JPEG, PNG or WebP photo.');
      return;
    }
    setProcessing(true);
    try {
      setPreview(await fileToSquareJpeg(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process this photo.');
    } finally {
      setProcessing(false);
    }
  };

  const save = () => {
    if (!preview) return;
    setError(null);
    setProgress(0);
    upload.mutate(
      { image: preview, onProgress: setProgress },
      {
        onSuccess: () => {
          toast.success('Profile photo updated');
          close(false);
        },
        onError: (err) => setError(err instanceof ProfileRequestError ? (err.fieldErrors.image ?? err.message) : 'Upload failed. Please try again.'),
      },
    );
  };

  const removePhoto = () => {
    setError(null);
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Profile photo removed');
        close(false);
      },
      onError: (err) => setError(err instanceof ProfileRequestError ? err.message : 'Could not remove the photo.'),
    });
  };

  return (
    <SheetModal open={open} onOpenChange={close} title="Profile photo" description="Your photo is cropped to a square and shown to your gym staff." className="max-w-sm">
      <input ref={galleryRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} data-testid="photo-input" />
      <input ref={cameraRef} type="file" accept={ACCEPT} capture="user" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />

      <div className="grid place-items-center py-2">
        <Avatar className="size-40 ring-4 ring-primary/15">
          <AvatarImage src={preview ?? photoUrl ?? undefined} alt={preview ? 'New photo preview' : name} />
          <AvatarFallback className="bg-primary/10 text-4xl font-semibold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        {preview ? <p className="mt-2 text-xs font-medium text-muted-foreground">Preview — this is how it will look</p> : null}
      </div>

      {upload.isPending ? (
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading" className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.max(progress, 8)}%` }} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="grid gap-2">
          <LoadingButton onClick={save} loading={upload.isPending} loadingText="Uploading…" className="h-11">
            Save photo
          </LoadingButton>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => galleryRef.current?.click()}>
              Choose another
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => { setPreview(null); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button type="button" className="h-11 gap-2" disabled={processing || busy} onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="size-4" /> {processing ? 'Preparing…' : 'Choose a photo'}
          </Button>
          <Button type="button" variant="outline" className="h-11 gap-2 md:hidden" disabled={processing || busy} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" /> Take photo
          </Button>
          {photoUrl ? (
            <LoadingButton type="button" variant="ghost" className="h-11 gap-2 text-destructive hover:text-destructive" loading={remove.isPending} loadingText="Removing…" onClick={removePhoto}>
              <Trash2 className="size-4" /> Remove photo
            </LoadingButton>
          ) : null}
        </div>
      )}
    </SheetModal>
  );
}
