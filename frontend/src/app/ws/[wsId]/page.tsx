'use client';

import { GlobalStatusBar } from '@/components/global-status-bar';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { AlertCircle, Loader2, PackageX } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface WorkstationState {
  action: 'START' | 'NEXT' | 'STOP';
  kode_produk?: string;
  nama_produk?: string; // For notes
  langkah_sekarang?: number;
  total_langkah?: number;
  deskripsi_tugas?: string;
  standard_time_detik?: number;
  bom?: { nama_bahan: string; qty_dibutuhkan: number }[];
  message: string;
}

interface WorkstationInfo {
  id: string;
  nama_ws: string;
  tipe: string;
}

export default function WorkstationPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const wsId = params.wsId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WorkstationState | null>(null);
  const [boardData, setBoardData] = useState<any>(null);
  const currentWs = useMemo(() => boardData?.workstations?.find((ws: WorkstationInfo) => ws.id === wsId), [boardData, wsId]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!isLoadingSession && !activeSessionId) {
      router.push('/');
    }
  }, [activeSessionId, isLoadingSession, router]);

  const fetchBoardData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/kanban-board`, { cache: 'no-store' });
      if (res.ok) setBoardData(await res.json());
    } catch (err) {
      console.error('Failed to fetch board data:', err);
    }
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (activeSessionId) fetchBoardData();
  }, [activeSessionId, fetchBoardData]);

  const handleToggle = useCallback(async () => {
    if (!activeSessionId || isLoading) return;
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
        fetchBoardData(); // Refresh board data to show new stock
      } else {
        setWsState(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, wsId, apiUrl, isLoading, fetchBoardData]);

  // Listen for spacebar to trigger the action
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isLoading) {
        event.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading, handleToggle]);

  const isIdle = !wsState;

  const isHeijunkaEmpty = useMemo(() => {
    if (!boardData || !boardData.heijunkaQueue) return true;
    // Only consider QUEUED items as being in the "antrian"
    return boardData.heijunkaQueue.filter((q: any) => q.status === 'QUEUED').length === 0;
  }, [boardData]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isIdle) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isIdle, wsState?.kode_produk]); // Reset on new task

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (isLoadingSession || !activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4">
      {/* Top Row */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        <Frame stacked className="flex w-1/2 flex-col">
          <FrameHeader>
            <FrameTitle>Workstation: {wsId}</FrameTitle>
            {currentWs && <FrameDescription>{currentWs.nama_ws}</FrameDescription>}
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col p-0">
            <div className="flex-1 overflow-y-auto p-4 text-xl">
              {isIdle ? 'Tekan Spasi untuk memulai pekerjaan baru.' : wsState.deskripsi_tugas}
            </div>
            <div className="mt-auto border-t p-4">
              <h3 className="font-semibold">Catatan</h3>
              {isIdle ? (
                <p className="text-sm text-muted-foreground">Tidak ada pekerjaan aktif.</p>
              ) : (
                <p className="font-mono text-sm">
                  Produk: {wsState.nama_produk} ({wsState.kode_produk})
                </p>
              )}
            </div>
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/2 flex-col">
          <FrameHeader><FrameTitle>Gambar</FrameTitle></FrameHeader>
          <FramePanel className="flex items-center justify-center">
            <span className="italic text-muted-foreground">No image available</span>
          </FramePanel>
        </Frame>
      </div>

      {/* Bottom Row */}
      <div className="flex h-1/3 min-h-[320px] gap-4">
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader><FrameTitle>Gambar Tambahan</FrameTitle></FrameHeader>
          <FramePanel className="flex items-center justify-center">
            {isHeijunkaEmpty ? (
              <div className="text-center text-muted-foreground">
                <PackageX className="mx-auto h-8 w-8" />
                <p className="mt-2 font-semibold">Antrian Heijunka Kosong</p>
                <p className="text-xs">Menunggu pesanan baru dari PPIC.</p>
              </div>
            ) : (
              <p className="italic text-muted-foreground">No additional image</p>
            )}
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader><FrameTitle>Bahan Digunakan</FrameTitle></FrameHeader>
          <FramePanel className="overflow-y-auto">
            {isIdle || !wsState.bom || wsState.bom.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Tidak ada bahan untuk langkah ini.
              </div>
            ) : (
              <ul className="list-disc space-y-2 pl-5 text-lg">
                {wsState.bom.map((item, index) => (
                  <li key={index}>
                    {item.qty_dibutuhkan}x {item.nama_bahan}
                  </li>
                ))}
              </ul>
            )}
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader className="flex-row items-center justify-between">
            <FrameTitle>Timer & Waktu</FrameTitle>
            <GlobalStatusBar />
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col items-center justify-center gap-4">
            {isLoading ? (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            ) : error ? (
              <div className="text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <p className="mt-2 font-semibold text-destructive">Error</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : (
              <>
                <div
                  className={`text-6xl font-mono font-bold ${
                    !isIdle && wsState.standard_time_detik && elapsedTime > wsState.standard_time_detik
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}
                >
                  {isIdle ? '00:00' : formatTime(elapsedTime)}
                </div>
                <div className="font-bold text-muted-foreground">
                  Target: {isIdle ? '--' : wsState.standard_time_detik ?? '--'}s
                </div>
              </>
            )}
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}