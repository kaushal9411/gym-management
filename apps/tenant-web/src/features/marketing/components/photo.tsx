'use client';

import * as React from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

import type { HomePhoto } from '../images';

/**
 * A photo that fills its parent (the parent must be `relative` with a size). If the file is missing or
 * fails to load, a soft gradient shows instead, so a broken image never leaves a hole in the layout.
 */
export function Photo({ photo, className = '', priority = false, sizes = '(min-width: 1024px) 40vw, 100vw' }: { photo: HomePhoto; className?: string; priority?: boolean; sizes?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <div role="img" aria-label={photo.alt} className={`grid size-full place-items-center bg-gradient-to-br from-orange-500/25 via-foreground/5 to-cyan-400/25 ${className}`}>
        <ImageOff className="size-6 text-foreground/30" aria-hidden />
      </div>
    );
  }
  return <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
