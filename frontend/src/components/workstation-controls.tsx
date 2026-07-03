'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Frame, FrameHeader, FramePanel, FrameTitle, FrameDescription } from '@/components/reui/frame';
import { Badge } from '@/components/reui/badge';
import { Loader2, Play, StepForward, CheckSquare, AlertCircle, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProductionWorkstation } from './examples/c-kanban-5';

interface WorkstationControlsProps {
  sessionId: number;
  workstations: ProductionWorkstation[];
  className?: string;
  onActionComplete?: () => void; // To trigger a fast refresh of the Kanban board
}

interface WorkstationState {
  kode_produk?: string;
  langkah_sekarang?: number;
  total_langkah?: number;
  deskripsi_tugas?: string;
}

function SimulatorButton({
  sessionId,
  ws,
  onActionComplete,
}: {
  sessionId: number;
  ws: ProductionWorkstation;
  onActionComplete?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WorkstationState | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/sessions/${sessionId}/workstations/${ws.id}/toggle`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan aksi.');
      }

      // If the action was STOP, clear the local state (it's idle again)
      if (data.action === 'STOP') {
        setWsState(null);
      } else {
        // If START or NEXT, save the step information
        setWsState({
          kode_produk: data.kode_produk,
          langkah_sekarang: data.langkah_sekarang,
          total_langkah: data.total_langkah,
          deskripsi_tugas: data.deskripsi_tugas,
        });
      }

      onActionComplete?.(); // Tell the parent to refresh the kanban board instantly
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine button UI based on current state
  const isIdle = !wsState;
  const isLastStep = wsState && wsState.langkah_sekarang === wsState.total_langkah;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("size-2 rounded-full", isIdle ? "bg-slate-400" : "bg-blue-500 animate-pulse")} />
          <span className="font-semibold text-sm">{ws.nama_ws}</span>
        </div>
        <Badge variant={isIdle ? "outline" : "default"} size="sm" className="font-mono text-[10px]">
          {isIdle ? 'IDLE' : wsState.kode_produk}
        </Badge>
      </div>

      {!isIdle && (
        <div className="flex flex-col gap-1 rounded bg-background p-2 border border-border/40">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Langkah {wsState.langkah_sekarang} / {wsState.total_langkah}</span>
          </div>
          <span className="text-sm font-medium truncate">{wsState.deskripsi_tugas}</span>
        </div>
      )}

      {error && (
         <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-1.5 rounded">
           <AlertCircle className="size-3 shrink-0" />
           <span className="truncate">{error}</span>
         </div>
      )}

      <Button 
        size="sm" 
        className="w-full mt-1" 
        onClick={handleToggle} 
        disabled={isLoading}
        variant={isIdle ? "default" : (isLastStep ? "destructive" : "secondary")}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isIdle ? (
          <>
            <Play className="size-3.5 mr-1.5" /> Tarik & Mulai
          </>
        ) : isLastStep ? (
          <>
            <CheckSquare className="size-3.5 mr-1.5" /> Selesaikan
          </>
        ) : (
          <>
            <StepForward className="size-3.5 mr-1.5" /> Langkah Selanjutnya
          </>
        )}
      </Button>
    </div>
  );
}

export function WorkstationControls({ sessionId, workstations, className, onActionComplete }: WorkstationControlsProps) {
  return (
    <Frame stacked className={cn('flex flex-col', className)}>
      <FrameHeader className="shrink-0 pb-2">
        <FrameTitle className="flex items-center gap-2 text-lg">
          <Settings2 className="size-4" />
          Simulator Pabrik
        </FrameTitle>
        <FrameDescription className="text-xs">
          Tekan tombol untuk memicu tarikan Kanban (Pull System).
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-3 p-4 overflow-y-auto">
        {workstations.map((ws) => (
          <SimulatorButton 
            key={ws.id} 
            sessionId={sessionId} 
            ws={ws} 
            onActionComplete={onActionComplete} 
          />
        ))}
      </FramePanel>
    </Frame>
  );
}