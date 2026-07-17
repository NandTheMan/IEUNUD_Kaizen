'use client';

import { useState } from 'react';
import { Frame, FramePanel } from '@/components/reui/frame';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface MaterialCardProps {
  nama: string;
  gambarUrl?: string | null;
  stok?: number;
  className?: string;
}

export function MaterialCard({ nama, gambarUrl, stok, className }: MaterialCardProps) {
  // Tracks a *failed* image load separately from "no url provided" — a
  // truthy gambarUrl that 404s still needs to fall back to the icon.
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(gambarUrl) && !imgFailed;

  return (
    <Frame stacked spacing="xs" className={cn('w-full overflow-hidden', className)}>
      {/* Image area — fixed aspect ratio instead of flex-1/h-full, so it has
          real, deterministic height regardless of how the parent grid sizes
          this card (that's what was collapsing it down to icon-size). */}
      <FramePanel className="relative aspect-square w-full !p-0">
        {showImage ? (
          <img
            src={gambarUrl!}
            alt={nama}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <ImageIcon className="text-muted-foreground h-8 w-8" />
          </div>
        )}
      </FramePanel>

      {/* Caption strip — sized to its own content, pinned under the image */}
      <FramePanel className="flex shrink-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold leading-tight" title={nama}>
          {nama}
        </p>
        {stok !== undefined && (
          <p className="shrink-0 font-mono text-sm font-bold tabular-nums">{stok}</p>
        )}
      </FramePanel>
    </Frame>
  );
}