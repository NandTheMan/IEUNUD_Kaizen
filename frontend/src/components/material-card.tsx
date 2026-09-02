'use client';

import { Frame, FramePanel } from '@/components/reui/frame';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

interface MaterialCardProps {
  nama: string;
  gambarUrl?: string | null;
  stok?: number;
  className?: string;
  fit?: 'fill' | 'square';
}

export function MaterialCard({ nama, gambarUrl, stok, className, fit }: MaterialCardProps) {
  // Tracks a *failed* image load separately from "no url provided" — a
  // truthy gambarUrl that 404s still needs to fall back to the icon.
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(gambarUrl) && !imgFailed;

  const isFill = fit === 'fill' || className?.includes('h-full');

  return (
    <Frame
      stacked
      spacing="xs"
      className={cn(
        'w-full overflow-hidden',
        isFill && 'h-full min-h-0 flex flex-col',
        className
      )}
    >
      {/* Image area */}
      <FramePanel
        className={cn(
          'relative w-full !p-0',
          isFill ? 'flex-1 min-h-0 overflow-hidden' : 'aspect-square'
        )}
      >
        {showImage ? (
          <img
            src={gambarUrl!}
            alt={nama}
            onError={() => setImgFailed(true)}
            className={cn(
              'absolute inset-0 h-full w-full',
              isFill ? 'object-contain p-1' : 'object-cover'
            )}
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <ImageIcon className={cn('text-muted-foreground', isFill ? 'h-6 w-6' : 'h-8 w-8')} />
          </div>
        )}
      </FramePanel>

      {/* Caption strip — sized to its own content, pinned under the image */}
      <FramePanel
        fit
        className={cn(
          'flex shrink-0 !grow-0 items-center justify-between gap-1 px-2 py-1',
          !isFill && 'gap-2'
        )}
      >
        <p className="min-w-0 truncate text-xs font-bold leading-tight" title={nama}>
          {nama}
        </p>
        {stok !== undefined && (
          <p className="shrink-0 font-mono text-xs font-bold tabular-nums">{stok}</p>
        )}
      </FramePanel>
    </Frame>
  );
}