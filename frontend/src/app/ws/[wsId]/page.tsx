'use client';

import { Badge } from '@/components/reui/badge';
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckSquare, Factory, Loader2, Play, StepForward } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface WorkstationState {
  action: 'START' | 'NEXT' | 'STOP';
  kode_produk?: string;
  langkah_sekarang?: number;
  total_langkah?: number;
  deskripsi_tugas?: string;
  message: string;
}

export default function WorkstationPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const wsId = params.wsId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WorkstationState | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Redirect if no active session
  useEffect(() => {
    if (!isLoadingSession && !activeSessionId) {
      router.push('/');
    }
  }, [activeSessionId, isLoadingSession, router]);

  const handleToggle = async () => {
    if (!activeSessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/toggle`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan aksi.');
      }

      if (data.action === 'STOP') {
        setWsState(null);
      } else {
        setWsState(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const isIdle = !wsState;
  const isLastStep = wsState && wsState.langkah_sekarang === wsState.total_langkah;

  if (isLoadingSession || !activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/50 p-4">
      <Frame className="w-full max-w-md">
        <FrameHeader>
          <div className="flex items-center justify-between">
            <FrameTitle className="flex items-center gap-3 text-2xl">
              <Factory className="size-6" />
              Workstation {wsId}
            </FrameTitle>
            <Badge variant={isIdle ? "outline" : "default"} size="lg">
              {isIdle ? 'IDLE' : 'IN-PROGRESS'}
            </Badge>
          </div>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-border/60 bg-background p-4 text-center">
            {isIdle ? (
              <p className="text-muted-foreground">Ready to pull new work.</p>
            ) : (
              <>
                <p className="font-mono text-sm text-muted-foreground">{wsState.kode_produk}</p>
                <p className="text-lg font-semibold">{wsState.deskripsi_tugas}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Step {wsState.langkah_sekarang} of {wsState.total_langkah}
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              <AlertCircle className="size-4 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <Button 
            onClick={handleToggle} 
            disabled={isLoading}
            className="h-20 w-full text-xl"
            variant={isIdle ? "default" : (isLastStep ? "destructive" : "secondary")}
          >
            {isLoading ? <Loader2 className="size-8 animate-spin" /> : isIdle ? (
              <><Play className="size-6 mr-3" /> Pull & Start Work</>
            ) : isLastStep ? (
              <><CheckSquare className="size-6 mr-3" /> Finish Work</>
            ) : (
              <><StepForward className="size-6 mr-3" /> Next Step</>
            )}
          </Button>
        </FramePanel>
      </Frame>
    </div>
  );
}